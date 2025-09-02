import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { normalizeName, mergeSources, mergeArrays, getBetterName, retryWithBackoff } from '../../ingest/utils/dedupe.ts'

// Germany bounding box
const GERMANY_BOUNDS = {
  south: 47.2,
  north: 55.1,
  west: 5.8,
  east: 15.1
};

const GRID_STEP = 0.75; // degrees for Ticketmaster API
const REQUEST_DELAY = 500; // ms between requests to respect rate limits

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple geohash encoder for Ticketmaster API
function encodeGeohash(lat: number, lng: number, precision = 9): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let geohash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        lngRange[0] = mid;
      } else {
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      geohash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

interface TicketmasterVenue {
  id: string;
  name: string;
  url?: string;
  location?: {
    latitude: string;
    longitude: string;
  };
  city?: {
    name: string;
  };
  country?: {
    countryCode: string;
  };
  address?: {
    line1?: string;
    postalCode?: string;
  };
}

interface TicketmasterResponse {
  _embedded?: {
    venues: TicketmasterVenue[];
  };
  _links?: {
    next?: {
      href: string;
    };
  };
  page?: {
    totalElements: number;
  };
}

async function fetchTicketmasterVenues(geohash: string, apiKey: string, page = 0): Promise<TicketmasterResponse> {
  const url = new URL('https://app.ticketmaster.com/discovery/v2/venues.json');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('countryCode', 'DE');
  url.searchParams.set('geoPoint', geohash);
  url.searchParams.set('radius', '50');
  url.searchParams.set('unit', 'km');
  url.searchParams.set('locale', 'de');
  url.searchParams.set('size', '200');
  url.searchParams.set('page', page.toString());

  console.log(`Fetching TM venues: ${url.toString()}`);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - check for Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
      throw new Error(`Rate limited. Retry after ${delay}ms`);
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

function ticketmasterVenueToVenue(tmVenue: TicketmasterVenue) {
  if (!tmVenue.name || !tmVenue.location?.latitude || !tmVenue.location?.longitude) {
    return null;
  }

  // Build address from Ticketmaster data
  const addressParts: any = {};
  if (tmVenue.address?.line1) addressParts.line1 = tmVenue.address.line1;
  if (tmVenue.address?.postalCode) addressParts.postalCode = tmVenue.address.postalCode;

  return {
    name: tmVenue.name,
    lat: Number(tmVenue.location.latitude),
    lng: Number(tmVenue.location.longitude),
    city: tmVenue.city?.name || null,
    country: tmVenue.country?.countryCode || 'DE',
    address: Object.keys(addressParts).length > 0 ? JSON.stringify(addressParts) : null,
    website: tmVenue.url || null,
    categories: ['music_venue'], // Ticketmaster venues are typically music venues
    sources: [{ src: 'tm', id: tmVenue.id }]
  };
}

async function upsertVenue(supabase: any, venue: any): Promise<'inserted' | 'merged'> {
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
    return 'merged';
  } else {
    // Insert new venue
    const { error: insertError } = await supabase
      .from('venues')
      .insert(venue);
      
    if (insertError) {
      console.error('Error inserting venue:', insertError);
      throw insertError;
    }
    
    console.log(`Inserted new venue: ${venue.name}`);
    return 'inserted';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Ticketmaster ingestion...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('TM_API_KEY') || Deno.env.get('TICKETMASTER_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let totalSeen = 0;
    let totalInserted = 0;
    let totalMerged = 0;
    
    // Generate grid of coordinates across Germany
    for (let lat = GERMANY_BOUNDS.south; lat < GERMANY_BOUNDS.north; lat += GRID_STEP) {
      for (let lng = GERMANY_BOUNDS.west; lng < GERMANY_BOUNDS.east; lng += GRID_STEP) {
        const centerLat = lat + GRID_STEP / 2;
        const centerLng = lng + GRID_STEP / 2;
        const geohash = encodeGeohash(centerLat, centerLng, 9);
        
        try {
          let page = 0;
          let hasMore = true;
          
          while (hasMore) {
            const data = await retryWithBackoff(
              async () => {
                const response = await fetchTicketmasterVenues(geohash, apiKey, page);
                
                // Handle rate limiting
                if (response instanceof Error && response.message.includes('Rate limited')) {
                  const delay = parseInt(response.message.match(/\d+/)?.[0] || '5000');
                  await new Promise(resolve => setTimeout(resolve, delay));
                  throw response; // Trigger retry
                }
                
                return response;
              },
              4, // max retries
              2000 // initial delay
            );
            
            const venues = data._embedded?.venues || [];
            console.log(`Processing ${venues.length} venues from geohash ${geohash}, page ${page}`);
            
            for (const tmVenue of venues) {
              const venue = ticketmasterVenueToVenue(tmVenue);
              if (!venue) continue;
              
              totalSeen++;
              
              try {
                const result = await upsertVenue(supabase, venue);
                if (result === 'inserted') totalInserted++;
                else totalMerged++;
              } catch (error) {
                console.error(`Error upserting venue ${venue.name}:`, error);
              }
            }
            
            // Check if there are more pages
            hasMore = !!data._links?.next && venues.length > 0;
            page++;
            
            // Rate limiting: pause between requests
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
          }
          
        } catch (error) {
          console.error(`Error processing geohash ${geohash}:`, error);
          // Continue with next geohash on error
        }
      }
    }
    
    const result = {
      ok: true,
      seen: totalSeen,
      inserted: totalInserted,
      merged: totalMerged,
      timestamp: new Date().toISOString()
    };
    
    console.log('Ticketmaster ingestion completed:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Ticketmaster ingestion error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});