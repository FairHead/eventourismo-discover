import { BBox, VenueSearchParams, Venue } from '@/types/venues';
import { fetchTicketmasterVenues } from './ticketmaster';
import { fetchEventbriteVenues } from './eventbrite';
import { fetchEventourismoVenues } from './eventourismo';
import { fetchOsmVenues } from './osm';
import { dedupeVenues } from '@/shared/lib/dedupe';

/**
 * Load and aggregate venues from all sources with deduplication
 */
export async function loadAggregatedVenues(params: VenueSearchParams): Promise<Venue[]> {
  console.log('🚀 Starting venue aggregation from all sources...');
  
  const startTime = performance.now();
  const debugMode = new URLSearchParams(window.location.search).has('debug');

  try {
    // Fetch from all sources in parallel for better performance
    const [
      ticketmasterVenues,
      eventbriteVenues,
      eventourismoVenues,
      osmVenues
    ] = await Promise.allSettled([
      fetchTicketmasterVenues(params),
      fetchEventbriteVenues(params),
      fetchEventourismoVenues(params),
      fetchOsmVenues(params),
    ]);

    // Process results and handle errors
    const allVenues: any[] = [];
    
    if (ticketmasterVenues.status === 'fulfilled') {
      allVenues.push(...ticketmasterVenues.value);
      if (debugMode) console.log('✅ Ticketmaster:', ticketmasterVenues.value.length, 'venues');
    } else {
      console.warn('❌ Ticketmaster failed:', ticketmasterVenues.reason);
    }
    
    if (eventbriteVenues.status === 'fulfilled') {
      allVenues.push(...eventbriteVenues.value);
      if (debugMode) console.log('✅ Eventbrite:', eventbriteVenues.value.length, 'venues');
    } else {
      console.warn('❌ Eventbrite failed:', eventbriteVenues.reason);
    }
    
    if (eventourismoVenues.status === 'fulfilled') {
      allVenues.push(...eventourismoVenues.value);
      if (debugMode) console.log('✅ Eventourismo:', eventourismoVenues.value.length, 'venues');
    } else {
      console.warn('❌ Eventourismo failed:', eventourismoVenues.reason);
    }
    
    if (osmVenues.status === 'fulfilled') {
      allVenues.push(...osmVenues.value);
      if (debugMode) console.log('✅ OpenStreetMap:', osmVenues.value.length, 'venues');
    } else {
      console.warn('❌ OSM failed:', osmVenues.reason);
    }

    console.log(`📊 Collected ${allVenues.length} venues from all sources`);

    // Debug: Log venues by source
    if (debugMode) {
      const venuesBySource = allVenues.reduce((acc, venue) => {
        acc[venue.source] = (acc[venue.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.table(venuesBySource);
    }

    // Deduplicate venues
    const deduplicatedVenues = dedupeVenues(allVenues);

    const endTime = performance.now();
    console.log(`🎯 Venue aggregation completed in ${Math.round(endTime - startTime)}ms`);
    console.log(`📍 Final result: ${deduplicatedVenues.length} unique venues`);

    return deduplicatedVenues;
    
  } catch (error) {
    console.error('❌ Error in venue aggregation:', error);
    return [];
  }
}

/**
 * Convert geographic bounds to BBox format for API calls
 */
export function mapBoundsToBBox(bounds: { 
  getSouthWest(): { lat: number; lng: number }; 
  getNorthEast(): { lat: number; lng: number };
}): BBox {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  return {
    minLat: sw.lat,
    minLng: sw.lng,
    maxLat: ne.lat,
    maxLng: ne.lng,
  };
}

/**
 * Validate if a venue is within the given bounding box
 */
export function isVenueInBounds(venue: Venue, bbox: BBox): boolean {
  return (
    venue.lat >= bbox.minLat &&
    venue.lat <= bbox.maxLat &&
    venue.lng >= bbox.minLng &&
    venue.lng <= bbox.maxLng
  );
}

/**
 * Get venue statistics for debugging
 */
export function getVenueStats(venues: Venue[]): Record<string, any> {
  const stats = {
    total: venues.length,
    bySources: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    multiSource: 0,
  };

  venues.forEach(venue => {
    // Count by source
    venue.sources.forEach(source => {
      stats.bySources[source.source] = (stats.bySources[source.source] || 0) + 1;
    });
    
    // Count by category
    if (venue.category) {
      stats.byCategory[venue.category] = (stats.byCategory[venue.category] || 0) + 1;
    }
    
    // Count multi-source venues
    if (venue.sources.length > 1) {
      stats.multiSource++;
    }
  });

  return stats;
}