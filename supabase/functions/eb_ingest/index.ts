import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { normalizeName, mergeSources, mergeArrays, getBetterName, retryWithBackoff } from '../../ingest/utils/dedupe.ts'

const REQUEST_DELAY = 1000; // ms between requests to respect rate limits

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventbriteVenue {
  id: string;
  name?: string;
  latitude?: string;
  longitude?: string;
  address?: {
    address_1?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  website?: string;
  resource_uri?: string;
}

interface EventbriteEvent {
  id: string;
  name?: {
    text: string;
  };
  description?: {
    text: string;
  };
  start?: {
    utc: string;
  };
  end?: {
    utc: string;
  };
  status?: string;
  url?: string;
  logo?: {
    url: string;
  };
  venue?: EventbriteVenue;
  venue_id?: string;
}

interface EventbriteResponse {
  events: EventbriteEvent[];
  pagination?: {
    has_more_items: boolean;
    continuation?: string;
  };
}

async function fetchEventbriteEvents(token: string, startDate: string, endDate: string, continuation?: string): Promise<EventbriteResponse> {
  const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
  url.searchParams.set('start_date.range_start', startDate);
  url.searchParams.set('start_date.range_end', endDate);
  url.searchParams.set('expand', 'venue');
  url.searchParams.set('location.address', 'Deutschland');
  url.searchParams.set('location.within', '50km');
  
  if (continuation) {
    url.searchParams.set('continuation', continuation);
  }

  console.log(`Fetching EB events: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - check for Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 30000; // Default 30s
      throw new Error(`Rate limited. Retry after ${delay}ms`);
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchEventbriteVenue(token: string, venueId: string): Promise<EventbriteVenue | null> {
  try {
    console.log(`Fetching venue details for ID: ${venueId}`);
    
    const response = await fetch(`https://www.eventbriteapi.com/v3/venues/${venueId}/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch venue ${venueId}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching venue ${venueId}:`, error);
    return null;
  }
}

function eventbriteVenueToVenue(ebVenue: EventbriteVenue) {
  if (!ebVenue.name || !ebVenue.latitude || !ebVenue.longitude) {
    return null;
  }

  // Build address from Eventbrite data
  const addressParts: any = {};
  if (ebVenue.address?.address_1) addressParts.line1 = ebVenue.address.address_1;
  if (ebVenue.address?.postal_code) addressParts.postalCode = ebVenue.address.postal_code;

  return {
    name: ebVenue.name,
    lat: Number(ebVenue.latitude),
    lng: Number(ebVenue.longitude),
    city: ebVenue.address?.city || null,
    country: ebVenue.address?.country || 'DE',
    address: Object.keys(addressParts).length > 0 ? JSON.stringify(addressParts) : null,
    website: ebVenue.website || ebVenue.resource_uri || null,
    categories: ['event_space'], // Eventbrite venues are typically event spaces
    sources: [{ src: 'eb', id: ebVenue.id }]
  };
}

function eventbriteEventToEvent(ebEvent: EventbriteEvent, venueId: string) {
  if (!ebEvent.name?.text) {
    return null;
  }

  return {
    title: ebEvent.name.text,
    description: ebEvent.description?.text || null,
    start_utc: ebEvent.start?.utc || null,
    end_utc: ebEvent.end?.utc || null,
    status: ebEvent.status === 'live' ? 'published' : 'draft',
    ticket_url: ebEvent.url || null,
    images: ebEvent.logo?.url ? [ebEvent.logo.url] : [],
    sources: [{ src: 'eb', id: ebEvent.id }],
    venue_id: venueId,
    organizer_id: null, // Will need to be set by the system
    lat: 0, // Will be updated with venue coordinates
    lng: 0, // Will be updated with venue coordinates
    event_type: 'other'
  };
}

async function upsertVenue(supabase: any, venue: any): Promise<{ action: 'inserted' | 'merged', id: string }> {
  // Find candidates for deduplication
  const { data: candidates, error: candidatesError } = await supabase
    .rpc('venues_find_candidates', {
      v_name: venue.name,
      v_lat: venue.lat,
      v_lon: venue.lng,
      v_radius_m: 80
    });
    
  if (candidatesError) {
    console.error('Error finding candidates:', candidatesError);
    throw candidatesError;
  }
  
  if (candidates && candidates.length > 0) {
    // Merge with existing venue
    const existing = candidates[0];
    const mergedData: any = {
      name: getBetterName(existing.name, venue.name),
      sources: mergeSources(existing.sources || [], venue.sources),
    };
    
    // Update fields that are missing or could be improved
    if (!existing.website && venue.website) mergedData.website = venue.website;
    if (!existing.city && venue.city) mergedData.city = venue.city;
    if (!existing.country && venue.country) mergedData.country = venue.country;
    if (!existing.address && venue.address) mergedData.address = venue.address;
    if (venue.categories) {
      mergedData.categories = mergeArrays(existing.categories || [], venue.categories);
    }
    
    const { error: updateError } = await supabase
      .from('venues')
      .update(mergedData)
      .eq('id', existing.id);
      
    if (updateError) {
      console.error('Error updating venue:', updateError);
      throw updateError;
    }
    
    console.log(`Merged venue: ${venue.name} -> ${existing.name}`);
    return { action: 'merged', id: existing.id };
  } else {
    // Insert new venue
    const { data: insertData, error: insertError } = await supabase
      .from('venues')
      .insert(venue)
      .select('id')
      .single();
      
    if (insertError) {
      console.error('Error inserting venue:', insertError);
      throw insertError;
    }
    
    console.log(`Inserted new venue: ${venue.name}`);
    return { action: 'inserted', id: insertData.id };
  }
}

async function upsertEvent(supabase: any, event: any, venueId: string, venueLat: number, venueLng: number): Promise<'inserted' | 'merged'> {
  // Update event with venue coordinates
  event.venue_id = venueId;
  event.lat = venueLat;
  event.lng = venueLng;
  
  // Check if event already exists by source
  const { data: existing, error: findError } = await supabase
    .from('events')
    .select('*')
    .contains('sources', [{ src: 'eb', id: event.sources[0].id }])
    .maybeSingle();
    
  if (findError) {
    console.error('Error finding existing event:', findError);
    throw findError;
  }
  
  if (existing) {
    // Merge with existing event
    const mergedData: any = {
      sources: mergeSources(existing.sources || [], event.sources),
    };
    
    // Update fields that could be improved
    if (!existing.description && event.description) mergedData.description = event.description;
    if (!existing.ticket_url && event.ticket_url) mergedData.ticket_url = event.ticket_url;
    if (event.images && event.images.length > 0) {
      mergedData.images = mergeArrays(existing.images || [], event.images);
    }
    
    const { error: updateError } = await supabase
      .from('events')
      .update(mergedData)
      .eq('id', existing.id);
      
    if (updateError) {
      console.error('Error updating event:', updateError);
      throw updateError;
    }
    
    console.log(`Merged event: ${event.title}`);
    return 'merged';
  } else {
    // Insert new event - need a valid organizer_id
    // For now, we'll skip event insertion as we don't have a system user
    console.log(`Would insert new event: ${event.title} (skipping - no organizer)`);
    return 'inserted';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Eventbrite ingestion...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = Deno.env.get('EB_TOKEN') || Deno.env.get('EVENTBRITE_OAUTH_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Date range: now to now + 60 days
    const now = new Date();
    const startDate = now.toISOString();
    const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
    
    let totalSeen = 0;
    let totalInserted = 0;
    let totalMerged = 0;
    let totalEvents = 0;
    
    let continuation: string | undefined;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const data = await retryWithBackoff(
          async () => {
            const response = await fetchEventbriteEvents(token, startDate, endDate, continuation);
            
            // Handle rate limiting
            if (response instanceof Error && response.message.includes('Rate limited')) {
              const delay = parseInt(response.message.match(/\d+/)?.[0] || '30000');
              await new Promise(resolve => setTimeout(resolve, delay));
              throw response; // Trigger retry
            }
            
            return response;
          },
          4, // max retries
          5000 // initial delay
        );
        
        const events = data.events || [];
        console.log(`Processing ${events.length} events, continuation: ${continuation}`);
        
        for (const ebEvent of events) {
          try {
            let venue = ebEvent.venue;
            
            // If venue not expanded, fetch it separately
            if (!venue && ebEvent.venue_id) {
              venue = await fetchEventbriteVenue(token, ebEvent.venue_id);
              await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
            }
            
            if (!venue) {
              console.log(`Skipping event ${ebEvent.id} - no venue data`);
              continue;
            }
            
            const venueData = eventbriteVenueToVenue(venue);
            if (!venueData) {
              console.log(`Skipping event ${ebEvent.id} - invalid venue data`);
              continue;
            }
            
            totalSeen++;
            
            // Upsert venue
            const { action, id: venueId } = await upsertVenue(supabase, venueData);
            if (action === 'inserted') totalInserted++;
            else totalMerged++;
            
            // Optional: Upsert event
            const eventData = eventbriteEventToEvent(ebEvent, venueId);
            if (eventData) {
              await upsertEvent(supabase, eventData, venueId, venueData.lat, venueData.lng);
              totalEvents++;
            }
            
          } catch (error) {
            console.error(`Error processing event ${ebEvent.id}:`, error);
          }
        }
        
        // Check if there are more pages
        hasMore = data.pagination?.has_more_items || false;
        continuation = data.pagination?.continuation;
        
        // Rate limiting: pause between requests
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        
      } catch (error) {
        console.error(`Error fetching events with continuation ${continuation}:`, error);
        hasMore = false; // Stop on error
      }
    }
    
    const result = {
      ok: true,
      seen: totalSeen,
      inserted: totalInserted,
      merged: totalMerged,
      events: totalEvents,
      timestamp: new Date().toISOString()
    };
    
    console.log('Eventbrite ingestion completed:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Eventbrite ingestion error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});