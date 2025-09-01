import { BBox, TimeRange } from '@/types/sources';
import { Venue } from '@/types/models';
import { TicketmasterSource } from './ticketmaster';
import { EventbriteSource } from './eventbrite';
import { mergeVenues, mergeEvents } from '@/shared/lib/dedupe';

const sources = [
  new TicketmasterSource(),
  new EventbriteSource()
];

export interface LoadAggregatedParams {
  bbox?: BBox;
  timeRange?: TimeRange;
  updatedSince?: string;
}

export async function loadAggregated(params: LoadAggregatedParams): Promise<Venue[]> {
  console.log('Loading aggregated events and venues from all sources...');
  
  try {
    // Fetch from all sources in parallel
    const promises = sources.map(async (source) => {
      console.log(`Fetching from ${source.id}...`);
      const [venues, events] = await Promise.all([
        source.fetchVenues(params).catch(error => {
          console.error(`Error fetching venues from ${source.id}:`, error);
          return [];
        }),
        source.fetchEvents(params).catch(error => {
          console.error(`Error fetching events from ${source.id}:`, error);
          return [];
        })
      ]);
      
      return { source: source.id, venues, events };
    });
    
    const results = await Promise.all(promises);
    
    // Combine all raw data
    const allVenuesRaw = results.flatMap(r => r.venues);
    const allEventsRaw = results.flatMap(r => r.events);
    
    console.log(`Raw data: ${allVenuesRaw.length} venues, ${allEventsRaw.length} events`);
    
    // Deduplicate venues first
    const { venues, sourceToVenueId } = mergeVenues(allVenuesRaw);
    console.log(`After venue deduplication: ${venues.length} unique venues`);
    
    // Deduplicate events and assign to venues
    const mergedEvents = mergeEvents(allEventsRaw, sourceToVenueId);
    console.log(`After event deduplication: ${mergedEvents.length} unique events`);
    
    // Group events by venue
    const venueEventsMap = new Map<string, typeof mergedEvents>();
    mergedEvents.forEach(event => {
      const existing = venueEventsMap.get(event.venueId) || [];
      existing.push(event);
      venueEventsMap.set(event.venueId, existing);
    });
    
    // Assign events to venues and sort by start time
    venues.forEach(venue => {
      const events = venueEventsMap.get(venue.id) || [];
      venue.events = events.sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
    });
    
    // Filter out venues with no events
    const venuesWithEvents = venues.filter(venue => venue.events.length > 0);
    
    console.log(`Final result: ${venuesWithEvents.length} venues with ${mergedEvents.length} total events`);
    
    // Log deduplication statistics
    const eventCountsBySource = results.reduce((acc, r) => {
      acc[r.source] = r.events.length;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Events by source (raw):', eventCountsBySource);
    console.log('Deduplication efficiency:', {
      rawEvents: allEventsRaw.length,
      mergedEvents: mergedEvents.length,
      duplicatesRemoved: allEventsRaw.length - mergedEvents.length,
      dedupeRate: ((allEventsRaw.length - mergedEvents.length) / allEventsRaw.length * 100).toFixed(1) + '%'
    });
    
    return venuesWithEvents;
    
  } catch (error) {
    console.error('Error in loadAggregated:', error);
    throw error;
  }
}