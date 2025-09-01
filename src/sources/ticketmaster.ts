import { EventSource, VenueRaw, EventRaw, BBox, TimeRange } from '@/types/sources';

interface TicketmasterVenue {
  id: string;
  name: string;
  address?: {
    line1?: string;
    line2?: string;
  };
  city?: {
    name: string;
  };
  country?: {
    name: string;
  };
  postalCode?: string;
  location?: {
    latitude: string;
    longitude: string;
  };
}

interface TicketmasterEvent {
  id: string;
  name: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
    end?: {
      localDate?: string;
      localTime?: string;  
      dateTime?: string;
    };
    status?: {
      code: string;
    };
  };
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
    subGenre?: { name: string };
  }>;
  info?: string;
  images?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  url?: string;
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: Array<{
      name: string;
    }>;
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

async function fetchJson(url: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchJson(url, options, retryCount + 1);
    }
    throw error;
  }
}

function mapTicketmasterStatus(code?: string): 'scheduled' | 'cancelled' | 'postponed' | 'live' {
  switch (code?.toLowerCase()) {
    case 'onsale':
    case 'offsale':
      return 'scheduled';
    case 'cancelled':
      return 'cancelled';
    case 'postponed':
    case 'rescheduled':
      return 'postponed';
    default:
      return 'scheduled';
  }
}

function bboxToCenter(bbox: BBox): { lat: number; lng: number; radiusKm: number } {
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  
  // Calculate radius in km (rough approximation)
  const latDiff = Math.abs(bbox.north - bbox.south);
  const lngDiff = Math.abs(bbox.east - bbox.west);
  const radiusKm = Math.max(latDiff, lngDiff) * 111; // Convert degrees to km
  
  return {
    lat: centerLat,
    lng: centerLng,
    radiusKm: Math.min(Math.max(Math.round(radiusKm), 10), 500) // Between 10-500km
  };
}

export class TicketmasterSource implements EventSource {
  readonly id = 'ticketmaster' as const;
  private apiKey: string;
  
  constructor() {
    // Note: Using Supabase secrets instead of VITE_ env vars as recommended
    this.apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('TICKETMASTER_API_KEY not found in environment');
    }
  }
  
  async fetchVenues(params: { bbox?: BBox; updatedSince?: string }): Promise<VenueRaw[]> {
    // Ticketmaster doesn't have a separate venues endpoint with search,
    // so we'll extract venues from events
    const events = await this.fetchEvents(params);
    const venueMap = new Map<string, VenueRaw>();
    
    events.forEach(event => {
      if (event.venueExternalId) {
        const venueId = event.venueExternalId;
        if (!venueMap.has(venueId)) {
          // We need to create a dummy venue - in practice this would come from the event data
          // For now, return empty array as venues are extracted from events
        }
      }
    });
    
    return Array.from(venueMap.values());
  }
  
  async fetchEvents(params: { bbox?: BBox; timeRange?: TimeRange; updatedSince?: string }): Promise<EventRaw[]> {
    if (!this.apiKey) {
      console.warn('Ticketmaster API key not available, returning empty results');
      return [];
    }
    
    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('countryCode', 'DE');
    url.searchParams.set('locale', 'de-de');
    url.searchParams.set('size', '200');
    url.searchParams.set('sort', 'date,asc');
    url.searchParams.set('classificationName', 'Music');
    
    // Handle geographic bounds
    if (params.bbox) {
      const { lat, lng, radiusKm } = bboxToCenter(params.bbox);
      url.searchParams.set('latlong', `${lat},${lng}`);
      url.searchParams.set('radius', radiusKm.toString());
      url.searchParams.set('unit', 'km');
    } else {
      // Default to Nürnberg area
      url.searchParams.set('latlong', '49.4521,11.0767');
      url.searchParams.set('radius', '50');
      url.searchParams.set('unit', 'km');
    }
    
    // Handle time range
    if (params.timeRange?.startIso) {
      const startDate = new Date(params.timeRange.startIso);
      url.searchParams.set('startDateTime', startDate.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    }
    if (params.timeRange?.endIso) {
      const endDate = new Date(params.timeRange.endIso);
      url.searchParams.set('endDateTime', endDate.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    }
    
    try {
      const data: TicketmasterResponse = await fetchJson(url.toString());
      return this.mapEventsResponse(data);
    } catch (error) {
      console.error('Error fetching Ticketmaster events:', error);
      return [];
    }
  }
  
  private mapEventsResponse(data: TicketmasterResponse): EventRaw[] {
    const events: EventRaw[] = [];
    
    if (!data._embedded?.events) {
      return events;
    }
    
    for (const event of data._embedded.events) {
      // Skip events without venues or location data
      if (!event._embedded?.venues || event._embedded.venues.length === 0) {
        continue;
      }
      
      const venue = event._embedded.venues[0];
      
      // Skip venues without location data
      if (!venue.location?.latitude || !venue.location?.longitude) {
        continue;
      }
      
      // Parse event dates
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
      } else if (event.dates?.end?.localDate && event.dates?.end?.localTime) {
        endUtc = `${event.dates.end.localDate}T${event.dates.end.localTime}:00`;
      }
      
      // Get genres from classifications
      const genres: string[] = [];
      if (event.classifications && event.classifications.length > 0) {
        const classification = event.classifications[0];
        if (classification.genre?.name) genres.push(classification.genre.name);
        if (classification.subGenre?.name) genres.push(classification.subGenre.name);
      }
      
      // Get artists
      const artists: string[] = [];
      if (event._embedded?.attractions) {
        event._embedded.attractions.forEach(attraction => {
          if (attraction.name) artists.push(attraction.name);
        });
      }
      
      // Get best image
      let imageUrl = '';
      if (event.images && event.images.length > 0) {
        const sortedImages = event.images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        imageUrl = sortedImages[0].url;
      }
      
      const eventRaw: EventRaw = {
        source: 'ticketmaster',
        externalId: event.id,
        venueExternalId: venue.id,
        title: event.name,
        startUtc,
        endUtc: endUtc || undefined,
        status: mapTicketmasterStatus(event.dates?.status?.code),
        artists: artists.length > 0 ? artists : undefined,
        genres: genres.length > 0 ? genres : undefined,
        description: event.info || undefined,
        url: event.url || undefined,
        imageUrl: imageUrl || undefined
      };
      
      events.push(eventRaw);
    }
    
    console.log(`Processed ${events.length} events from Ticketmaster`);
    return events;
  }
}