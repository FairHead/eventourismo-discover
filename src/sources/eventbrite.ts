import { EventSource, VenueRaw, EventRaw, BBox, TimeRange } from '@/types/sources';

interface EventbriteVenue {
  id: string;
  name: string;
  address?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    country_name?: string;
    postal_code?: string;
  };
  latitude?: string;
  longitude?: string;
}

interface EventbriteEvent {
  id: string;
  name: {
    text: string;
  };
  summary?: string;
  description?: {
    text?: string;
  };
  start: {
    utc: string;
    local: string;
  };
  end: {
    utc: string;
    local: string;
  };
  status: string;
  venue_id?: string;
  venue?: EventbriteVenue;
  logo?: {
    url: string;
  };
  url: string;
  category?: {
    name: string;
  };
  format?: {
    name: string;
  };
  organizer?: {
    name: string;
  };
}

interface EventbriteResponse {
  events: EventbriteEvent[];
  pagination: {
    object_count: number;
    page_number: number;
    page_size: number;
    page_count: number;
    has_more_items: boolean;
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

function mapEventbriteStatus(status: string): 'scheduled' | 'cancelled' | 'postponed' | 'live' {
  switch (status.toLowerCase()) {
    case 'live':
      return 'live';
    case 'started':
      return 'live';
    case 'ended':
    case 'completed':
      return 'scheduled'; // Treat as scheduled for past events
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    case 'draft':
    case 'published':
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
    radiusKm: Math.min(Math.max(Math.round(radiusKm), 10), 200) // Between 10-200km for Eventbrite
  };
}

export class EventbriteSource implements EventSource {
  readonly id = 'eventbrite' as const;
  private baseUrl: string;
  private token: string;
  
  constructor() {
    this.baseUrl = import.meta.env.VITE_EVENTBRITE_BASE_URL || 'https://www.eventbriteapi.com/v3';
    this.token = import.meta.env.VITE_EVENTBRITE_OAUTH_TOKEN || '';
    
    if (!this.token) {
      console.warn('EVENTBRITE_OAUTH_TOKEN not found in environment');
    }
  }
  
  async fetchVenues(params: { bbox?: BBox; updatedSince?: string }): Promise<VenueRaw[]> {
    // Extract venues from events since Eventbrite doesn't have a separate venue API
    const events = await this.fetchEvents({ ...params, timeRange: undefined });
    const venuesMap = new Map<string, VenueRaw>();
    
    for (const event of events) {
      if (!event.venueExternalId) continue;
      
      const venueKey = `${event.source}:${event.venueExternalId}`;
      if (venuesMap.has(venueKey)) continue;
      
      // We need to fetch the event again to get venue details
      // For now, we'll extract from the cached event data
      const venue = await this.extractVenueFromEvent(event.venueExternalId);
      if (venue) {
        venuesMap.set(venueKey, venue);
      }
    }
    
    return Array.from(venuesMap.values());
  }
  
  async fetchEvents(params: { bbox?: BBox; timeRange?: TimeRange; updatedSince?: string }): Promise<EventRaw[]> {
    if (!this.token) {
      console.warn('Eventbrite OAuth token not available, returning empty results');
      return [];
    }
    
    const allEvents: EventRaw[] = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages && page <= 10) { // Limit to 10 pages max
      const events = await this.fetchEventsPage(params, page);
      if (events.length === 0) {
        hasMorePages = false;
      } else {
        allEvents.push(...events);
        page++;
      }
    }
    
    return allEvents;
  }
  
  private async fetchEventsPage(params: { bbox?: BBox; timeRange?: TimeRange; updatedSince?: string }, page = 1): Promise<EventRaw[]> {
    const url = new URL(`${this.baseUrl}/events/search/`);
    url.searchParams.set('expand', 'venue,category,format,organizer');
    url.searchParams.set('page', page.toString());
    url.searchParams.set('page_size', '200');
    
    // Handle geographic bounds using center + radius
    if (params.bbox) {
      const { lat, lng, radiusKm } = bboxToCenter(params.bbox);
      url.searchParams.set('location.latitude', lat.toString());
      url.searchParams.set('location.longitude', lng.toString());
      url.searchParams.set('location.within', `${radiusKm}km`);
    } else {
      // Default to Germany-wide search
      url.searchParams.set('location.address', 'Germany');
    }
    
    // Handle time range
    if (params.timeRange?.startIso) {
      url.searchParams.set('start_date.range_start', params.timeRange.startIso);
    }
    if (params.timeRange?.endIso) {
      url.searchParams.set('start_date.range_end', params.timeRange.endIso);
    }
    
    // Music and arts categories
    url.searchParams.set('categories', '103,105'); // Music, Performing & Visual Arts
    
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
    
    try {
      const data: EventbriteResponse = await fetchJson(url.toString(), { headers });
      return this.mapEventsResponse(data);
    } catch (error) {
      console.error('Error fetching Eventbrite events:', error);
      return [];
    }
  }
  
  private async extractVenueFromEvent(venueId: string): Promise<VenueRaw | null> {
    if (!this.token) return null;
    
    const url = `${this.baseUrl}/venues/${venueId}/`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
    
    try {
      const venue: EventbriteVenue = await fetchJson(url, { headers });
      
      if (!venue.latitude || !venue.longitude) {
        return null;
      }
      
      // Build venue address
      let address = '';
      if (venue.address?.address_1) {
        address = venue.address.address_1;
        if (venue.address.address_2) {
          address += `, ${venue.address.address_2}`;
        }
      }
      
      return {
        source: 'eventbrite',
        externalId: venue.id,
        name: venue.name,
        lat: parseFloat(venue.latitude),
        lng: parseFloat(venue.longitude),
        address: address || undefined,
        city: venue.address?.city,
        country: venue.address?.country_name,
        postalCode: venue.address?.postal_code
      };
    } catch (error) {
      console.warn(`Could not fetch venue ${venueId} from Eventbrite:`, error);
      return null;
    }
  }

  private mapEventsResponse(data: EventbriteResponse): EventRaw[] {
    const events: EventRaw[] = [];
    
    if (!data.events) {
      return events;
    }
    
    for (const event of data.events) {
      // Skip events without venues or location data
      if (!event.venue || !event.venue.latitude || !event.venue.longitude) {
        continue;
      }
      
      const venue = event.venue;
      
      // Get genres from category and format
      const genres: string[] = [];
      if (event.category?.name) genres.push(event.category.name);
      if (event.format?.name) genres.push(event.format.name);
      
      // Get artists (Eventbrite doesn't have explicit artists, use organizer)
      const artists: string[] = [];
      if (event.organizer?.name) artists.push(event.organizer.name);
      
      const eventRaw: EventRaw = {
        source: 'eventbrite',
        externalId: event.id,
        venueExternalId: venue.id,
        title: event.name.text,
        startUtc: event.start.utc,
        endUtc: event.end.utc,
        status: mapEventbriteStatus(event.status),
        artists: artists.length > 0 ? artists : undefined,
        genres: genres.length > 0 ? genres : undefined,
        description: event.summary || event.description?.text || undefined,
        url: event.url,
        imageUrl: event.logo?.url || undefined
      };
      
      events.push(eventRaw);
    }
    
    console.log(`Processed ${events.length} events from Eventbrite (page)`);
    return events;
  }
}