import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types for aggregated multi-source system
type SourceId = 'ticketmaster' | 'eventbrite';

interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface TimeRange {
  startIso?: string;
  endIso?: string;
}

interface VenueRaw {
  source: SourceId;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
}

interface EventRaw {
  source: SourceId;
  externalId: string;
  venueExternalId?: string;
  title: string;
  startUtc: string;
  endUtc?: string;
  status?: 'scheduled'|'cancelled'|'postponed'|'live';
  artists?: string[];
  genres?: string[];
  description?: string;
  url?: string;
  imageUrl?: string;
}

interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
  sources: Array<{source: SourceId; externalId: string}>;
  events: Event[];
}

interface Event {
  id: string;
  title: string;
  startUtc: string;
  endUtc?: string;
  status?: 'scheduled'|'cancelled'|'postponed'|'live';
  artists?: string[];
  genres?: string[];
  description?: string;
  url?: string;
  imageUrl?: string;
  sources: Array<{source: SourceId; externalId: string}>;
  venueId: string;
}

// Legacy interface for backward compatibility
interface ExternalEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  category?: string;
  description?: string;
  image_url?: string;
  ticket_url?: string;
  source: SourceId;
  venue: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    lat: number;
    lng: number;
  };
}

// Load aggregated venues and events from all sources
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const inputBounds = body?.bounds || body?.bbox || null;
    const dateFrom = body?.date_from || null;
    const dateTo = body?.date_to || null;
    
    console.log('Fetching aggregated events for bounds/bbox:', inputBounds, 'dateFrom:', dateFrom, 'dateTo:', dateTo);

    const bbox: BBox | undefined = inputBounds ? {
      north: inputBounds.north,
      south: inputBounds.south,
      east: inputBounds.east,
      west: inputBounds.west
    } : undefined;
    
    const timeRange: TimeRange = {
      startIso: dateFrom,
      endIso: dateTo
    };

    // Load aggregated data from all sources
    const venues = await loadAggregated({ bbox, timeRange });
    
    // Convert to legacy format for backward compatibility
    const legacyEvents: ExternalEvent[] = [];
    venues.forEach(venue => {
      venue.events.forEach(event => {
        const legacyEvent: ExternalEvent = {
          id: event.id,
          title: event.title,
          starts_at: event.startUtc,
          ends_at: event.endUtc,
          category: event.genres?.join(', '),
          description: event.description,
          image_url: event.imageUrl,
          ticket_url: event.url,
          source: event.sources[0]?.source || 'ticketmaster',
          venue: {
            id: venue.sources[0]?.externalId || venue.id,
            name: venue.name,
            address: venue.address,
            city: venue.city,
            lat: venue.lat,
            lng: venue.lng,
          }
        };
        legacyEvents.push(legacyEvent);
      });
    });

    console.log(`Returning ${legacyEvents.length} aggregated events from ${venues.length} venues`);

    return new Response(
      JSON.stringify({ events: legacyEvents }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-external-events function:', error);
    return new Response(
      JSON.stringify({ 
        events: [],
        warning: {
          source: 'edge-function',
          message: 'Internal server error',
          details: (error as Error).message || String(error)
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Multi-source aggregation implementation
async function loadAggregated(params: { bbox?: BBox; timeRange?: TimeRange }): Promise<Venue[]> {
  console.log('Loading aggregated events and venues from all sources...');
  
  try {
    // Fetch from all sources in parallel
    const [ticketmasterResults, eventbriteResults] = await Promise.all([
      fetchTicketmasterData(params),
      fetchEventbriteData(params)
    ]);
    
    // Combine all raw data
    const allVenuesRaw = [...ticketmasterResults.venues, ...eventbriteResults.venues];
    const allEventsRaw = [...ticketmasterResults.events, ...eventbriteResults.events];
    
    console.log(`Raw data: ${allVenuesRaw.length} venues, ${allEventsRaw.length} events`);
    
    // Deduplicate venues first
    const { venues, sourceToVenueId } = mergeVenues(allVenuesRaw);
    console.log(`After venue deduplication: ${venues.length} unique venues`);
    
    // Deduplicate events and assign to venues
    const mergedEvents = mergeEvents(allEventsRaw, sourceToVenueId);
    console.log(`After event deduplication: ${mergedEvents.length} unique events`);
    
    // Group events by venue
    const venueEventsMap = new Map<string, Event[]>();
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
    
    return venuesWithEvents;
    
  } catch (error) {
    console.error('Error in loadAggregated:', error);
    throw error;
  }
}

async function fetchTicketmasterData(params: { bbox?: BBox; timeRange?: TimeRange }): Promise<{ venues: VenueRaw[], events: EventRaw[] }> {
  const ticketmasterApiKey = Deno.env.get('TICKETMASTER_API_KEY');
  
  if (!ticketmasterApiKey) {
    console.warn('TICKETMASTER_API_KEY not found, skipping Ticketmaster');
    return { venues: [], events: [] };
  }

  const eventsUrl = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
  eventsUrl.searchParams.set('apikey', ticketmasterApiKey);
  eventsUrl.searchParams.set('countryCode', 'DE');
  eventsUrl.searchParams.set('locale', 'de-de');
  eventsUrl.searchParams.set('size', '200');
  eventsUrl.searchParams.set('sort', 'date,asc');
  eventsUrl.searchParams.set('classificationName', 'Music');

  // Handle geographic bounds
  if (params.bbox) {
    const centerLat = (params.bbox.north + params.bbox.south) / 2;
    const centerLng = (params.bbox.east + params.bbox.west) / 2;
    const latDiff = Math.abs(params.bbox.north - params.bbox.south);
    const lngDiff = Math.abs(params.bbox.east - params.bbox.west);
    const radiusKm = Math.max(latDiff, lngDiff) * 111;
    
    eventsUrl.searchParams.set('latlong', `${centerLat},${centerLng}`);
    eventsUrl.searchParams.set('radius', Math.min(Math.max(Math.round(radiusKm), 10), 500).toString());
    eventsUrl.searchParams.set('unit', 'km');
  } else {
    eventsUrl.searchParams.set('latlong', '49.4521,11.0767');
    eventsUrl.searchParams.set('radius', '50');
    eventsUrl.searchParams.set('unit', 'km');
  }

  // Handle time range
  if (params.timeRange?.startIso) {
    const startDate = new Date(params.timeRange.startIso);
    eventsUrl.searchParams.set('startDateTime', startDate.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  }
  if (params.timeRange?.endIso) {
    const endDate = new Date(params.timeRange.endIso);
    eventsUrl.searchParams.set('endDateTime', endDate.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  }

  try {
    const response = await fetch(eventsUrl.toString());
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }

    const data = await response.json();
    const events: EventRaw[] = [];
    const venuesMap = new Map<string, VenueRaw>();

    if (data._embedded?.events) {
      for (const event of data._embedded.events) {
        if (!event._embedded?.venues || event._embedded.venues.length === 0) continue;
        
        const venue = event._embedded.venues[0];
        if (!venue.location?.latitude || !venue.location?.longitude) continue;

        // Create venue if not exists
        if (!venuesMap.has(venue.id)) {
          let address = '';
          if (venue.address?.line1) {
            address = venue.address.line1;
            if (venue.address.line2) address += `, ${venue.address.line2}`;
          }

          venuesMap.set(venue.id, {
            source: 'ticketmaster',
            externalId: venue.id,
            name: venue.name,
            lat: parseFloat(venue.location.latitude),
            lng: parseFloat(venue.location.longitude),
            address,
            city: venue.city?.name,
          });
        }

        // Parse dates
        let startUtc = '';
        let endUtc = '';
        
        if (event.dates?.start?.dateTime) {
          startUtc = event.dates.start.dateTime;
        } else if (event.dates?.start?.localDate && event.dates?.start?.localTime) {
          startUtc = `${event.dates.start.localDate}T${event.dates.start.localTime}:00`;
        } else if (event.dates?.start?.localDate) {
          startUtc = `${event.dates.start.localDate}T20:00:00`;
        }

        if (event.dates?.end?.dateTime) {
          endUtc = event.dates.end.dateTime;
        }

        // Get genres and artists
        const genres: string[] = [];
        if (event.classifications?.[0]) {
          const c = event.classifications[0];
          if (c.genre?.name) genres.push(c.genre.name);
          if (c.subGenre?.name) genres.push(c.subGenre.name);
        }

        const artists: string[] = [];
        event._embedded?.attractions?.forEach((attraction: any) => {
          if (attraction.name) artists.push(attraction.name);
        });

        let imageUrl = '';
        if (event.images?.length) {
          const sorted = event.images.sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height));
          imageUrl = sorted[0].url;
        }

        events.push({
          source: 'ticketmaster',
          externalId: event.id,
          venueExternalId: venue.id,
          title: event.name,
          startUtc,
          endUtc: endUtc || undefined,
          status: 'scheduled',
          artists: artists.length ? artists : undefined,
          genres: genres.length ? genres : undefined,
          description: event.info,
          url: event.url,
          imageUrl: imageUrl || undefined
        });
      }
    }

    console.log(`Fetched ${events.length} events from Ticketmaster`);
    return { venues: Array.from(venuesMap.values()), events };
    
  } catch (error) {
    console.error('Error fetching Ticketmaster data:', error);
    return { venues: [], events: [] };
  }
}

async function fetchEventbriteData(params: { bbox?: BBox; timeRange?: TimeRange }): Promise<{ venues: VenueRaw[], events: EventRaw[] }> {
  const eventbriteToken = Deno.env.get('EVENTBRITE_OAUTH_TOKEN');
  
  if (!eventbriteToken) {
    console.warn('EVENTBRITE_OAUTH_TOKEN not found, skipping Eventbrite');
    return { venues: [], events: [] };
  }

  const baseUrl = 'https://www.eventbriteapi.com/v3';
  const url = new URL(`${baseUrl}/events/search/`);
  url.searchParams.set('expand', 'venue,category,format,organizer');
  url.searchParams.set('page_size', '200');
  url.searchParams.set('categories', '103,105'); // Music, Performing & Visual Arts

  // Handle geographic bounds
  if (params.bbox) {
    const centerLat = (params.bbox.north + params.bbox.south) / 2;
    const centerLng = (params.bbox.east + params.bbox.west) / 2;
    const latDiff = Math.abs(params.bbox.north - params.bbox.south);
    const lngDiff = Math.abs(params.bbox.east - params.bbox.west);
    const radiusKm = Math.min(Math.max(Math.round(Math.max(latDiff, lngDiff) * 111), 10), 200);
    
    url.searchParams.set('location.latitude', centerLat.toString());
    url.searchParams.set('location.longitude', centerLng.toString());
    url.searchParams.set('location.within', `${radiusKm}km`);
  } else {
    url.searchParams.set('location.address', 'Germany');
  }

  // Handle time range
  if (params.timeRange?.startIso) {
    url.searchParams.set('start_date.range_start', params.timeRange.startIso);
  }
  if (params.timeRange?.endIso) {
    url.searchParams.set('start_date.range_end', params.timeRange.endIso);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${eventbriteToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Eventbrite API error: ${response.status}`);
    }

    const data = await response.json();
    const events: EventRaw[] = [];
    const venuesMap = new Map<string, VenueRaw>();

    if (data.events) {
      for (const event of data.events) {
        if (!event.venue?.latitude || !event.venue?.longitude) continue;

        const venue = event.venue;

        // Create venue if not exists
        if (!venuesMap.has(venue.id)) {
          let address = '';
          if (venue.address?.address_1) {
            address = venue.address.address_1;
            if (venue.address.address_2) address += `, ${venue.address.address_2}`;
          }

          venuesMap.set(venue.id, {
            source: 'eventbrite',
            externalId: venue.id,
            name: venue.name,
            lat: parseFloat(venue.latitude),
            lng: parseFloat(venue.longitude),
            address,
            city: venue.address?.city,
            country: venue.address?.country_name,
            postalCode: venue.address?.postal_code
          });
        }

        // Get genres and artists
        const genres: string[] = [];
        if (event.category?.name) genres.push(event.category.name);
        if (event.format?.name) genres.push(event.format.name);

        const artists: string[] = [];
        if (event.organizer?.name) artists.push(event.organizer.name);

        events.push({
          source: 'eventbrite',
          externalId: event.id,
          venueExternalId: venue.id,
          title: event.name.text,
          startUtc: event.start.utc,
          endUtc: event.end.utc,
          status: event.status === 'live' ? 'live' : 'scheduled',
          artists: artists.length ? artists : undefined,
          genres: genres.length ? genres : undefined,
          description: event.summary || event.description?.text,
          url: event.url,
          imageUrl: event.logo?.url
        });
      }
    }

    console.log(`Fetched ${events.length} events from Eventbrite`);
    return { venues: Array.from(venuesMap.values()), events };
    
  } catch (error) {
    console.error('Error fetching Eventbrite data:', error);
    return { venues: [], events: [] };
  }
}

// Deduplication functions (simplified versions for edge function)
function mergeVenues(venuesRaw: VenueRaw[]): { venues: Venue[], sourceToVenueId: Map<string, string> } {
  const venues: Venue[] = [];
  const sourceToVenueId = new Map<string, string>();
  
  for (const raw of venuesRaw) {
    const normalizedName = normalizeName(raw.name);
    
    // Simple venue matching by name similarity and proximity
    let matchingVenue: Venue | null = null;
    
    for (const existing of venues) {
      const distance = haversine(raw.lat, raw.lng, existing.lat, existing.lng);
      const nameSim = jaroWinkler(normalizedName, normalizeName(existing.name));
      
      if (distance <= 75 && nameSim >= 0.88) {
        matchingVenue = existing;
        break;
      }
    }
    
    if (matchingVenue) {
      matchingVenue.sources.push({ source: raw.source, externalId: raw.externalId });
      sourceToVenueId.set(`${raw.source}:${raw.externalId}`, matchingVenue.id);
    } else {
      const venueId = generateHash(`${normalizedName}-${raw.city || ''}-${Math.round(raw.lat * 1000)}-${Math.round(raw.lng * 1000)}`);
      
      const newVenue: Venue = {
        id: venueId,
        name: raw.name,
        lat: raw.lat,
        lng: raw.lng,
        address: raw.address,
        city: raw.city,
        country: raw.country,
        sources: [{ source: raw.source, externalId: raw.externalId }],
        events: []
      };
      
      venues.push(newVenue);
      sourceToVenueId.set(`${raw.source}:${raw.externalId}`, venueId);
    }
  }
  
  return { venues, sourceToVenueId };
}

function mergeEvents(eventsRaw: EventRaw[], sourceToVenueId: Map<string, string>): Event[] {
  const events: Event[] = [];
  
  for (const raw of eventsRaw) {
    const venueKey = raw.venueExternalId ? `${raw.source}:${raw.venueExternalId}` : '';
    const venueId = sourceToVenueId.get(venueKey);
    
    if (!venueId) continue;
    
    const normalizedTitle = normalizeTitle(raw.title);
    const startDate = new Date(raw.startUtc);
    
    // Simple event matching
    let matchingEvent: Event | null = null;
    
    for (const existing of events) {
      if (existing.venueId !== venueId) continue;
      
      const existingStart = new Date(existing.startUtc);
      const timeDiff = Math.abs(startDate.getTime() - existingStart.getTime());
      const titleSim = jaroWinkler(normalizedTitle, normalizeTitle(existing.title));
      
      if (timeDiff <= 10 * 60 * 1000 && titleSim >= 0.90) {
        matchingEvent = existing;
        break;
      }
    }
    
    if (matchingEvent) {
      matchingEvent.sources.push({ 
        source: raw.source, 
        externalId: raw.externalId 
      });
      
      // Merge data
      if (raw.artists) {
        const existing = matchingEvent.artists || [];
        matchingEvent.artists = [...new Set([...existing, ...raw.artists])];
      }
      if (raw.genres) {
        const existing = matchingEvent.genres || [];
        matchingEvent.genres = [...new Set([...existing, ...raw.genres])];
      }
      
    } else {
      const flooredStart = new Date(startDate);
      flooredStart.setMinutes(Math.floor(flooredStart.getMinutes() / 15) * 15, 0, 0);
      
      const eventId = generateHash(`${venueId}-${flooredStart.toISOString()}-${normalizedTitle}`);
      
      events.push({
        id: eventId,
        title: raw.title,
        startUtc: raw.startUtc,
        endUtc: raw.endUtc,
        status: raw.status,
        artists: raw.artists,
        genres: raw.genres,
        description: raw.description,
        url: raw.url,
        imageUrl: raw.imageUrl,
        sources: [{ source: raw.source, externalId: raw.externalId }],
        venueId
      });
    }
  }
  
  return events;
}

// Utility functions
function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeTitle(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // Simplified version - just check string similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshtein(s1, s2);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function generateHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString();
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}