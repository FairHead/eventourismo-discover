import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useVenueIngestion = () => {
  useEffect(() => {
    const ingestVenues = async () => {
      try {
        console.log('Starting venue ingestion...');
        
        // Get Germany bounding box for comprehensive coverage
        const germanyBbox = {
          south: 47.2,
          west: 5.8,
          north: 55.1,
          east: 15.0
        };

        // Trigger all venue ingestion functions in parallel
        const promises = [
          supabase.functions.invoke('osm_ingest', {
            body: { bbox: germanyBbox }
          }),
          supabase.functions.invoke('tm_ingest', {
            body: { bbox: germanyBbox }
          }),
          supabase.functions.invoke('eb_ingest', {
            body: { bbox: germanyBbox }
          })
        ];

        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          const sources = ['OSM', 'Ticketmaster', 'Eventbrite'];
          if (result.status === 'fulfilled') {
            console.log(`${sources[index]} venue ingestion completed:`, result.value);
          } else {
            console.error(`${sources[index]} venue ingestion failed:`, result.reason);
          }
        });

        console.log('Venue ingestion completed');
      } catch (error) {
        console.error('Error during venue ingestion:', error);
      }
    };

    // Run venue ingestion on app start
    ingestVenues();
  }, []);
};