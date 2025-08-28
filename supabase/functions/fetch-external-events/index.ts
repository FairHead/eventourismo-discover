import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  };
}

interface ExternalEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  category?: string;
  description?: string;
  image_url?: string;
  ticket_url?: string;
  source: 'ticketmaster';
  venue: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    lat: number;
    lng: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ticketmasterApiKey = Deno.env.get('TICKETMASTER_API_KEY');
    
    if (!ticketmasterApiKey) {
      console.error('TICKETMASTER_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ error: 'Ticketmaster API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = await req.json();
    const inputBounds = body?.bounds || body?.bbox || null;
    const dateFrom = body?.date_from || null;
    const dateTo = body?.date_to || null;
    console.log('Fetching external events for bounds/bbox:', inputBounds, 'dateFrom:', dateFrom, 'dateTo:', dateTo);

    // Fetch events from Ticketmaster API for Germany
    const eventsUrl = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    eventsUrl.searchParams.set('apikey', ticketmasterApiKey);
    eventsUrl.searchParams.set('countryCode', 'DE');
    eventsUrl.searchParams.set('locale', 'de-de');
    eventsUrl.searchParams.set('size', '200');
    eventsUrl.searchParams.set('sort', 'date,asc');
    eventsUrl.searchParams.set('classificationName', 'Music');

    if (dateFrom) eventsUrl.searchParams.set('startDateTime', new Date(dateFrom).toISOString());
    if (dateTo) eventsUrl.searchParams.set('endDateTime', new Date(dateTo).toISOString());
    
    // Add geographic bounds if provided
    if (inputBounds) {
      // Ticketmaster uses latlong and radius instead of bounds
      const north = inputBounds.north;
      const south = inputBounds.south;
      const east = inputBounds.east;
      const west = inputBounds.west;

      if (typeof north === 'number' && typeof south === 'number' && typeof east === 'number' && typeof west === 'number') {
        const centerLat = (north + south) / 2;
        const centerLng = (east + west) / 2;
        
        // Calculate radius in km (rough approximation)
        const latDiff = Math.abs(north - south);
        const lngDiff = Math.abs(east - west);
        const radiusKm = Math.max(latDiff, lngDiff) * 111; // Convert degrees to km (rough)
        
        eventsUrl.searchParams.set('latlong', `${centerLat},${centerLng}`);
        eventsUrl.searchParams.set('radius', Math.min(Math.max(Math.round(radiusKm), 10), 500).toString()); // Between 10-500km
        eventsUrl.searchParams.set('unit', 'km');
      }
    }

    console.log('Fetching from Ticketmaster:', eventsUrl.toString());

    const response = await fetch(eventsUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ticketmaster API error:', response.status, response.statusText, errorText);
      // Return empty events but include warning so the client doesn't throw
      return new Response(
        JSON.stringify({ 
          events: [],
          warning: {
            source: 'ticketmaster',
            status: response.status,
            statusText: response.statusText,
            body: errorText
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Ticketmaster API response:', JSON.stringify(data, null, 2));

    const events: ExternalEvent[] = [];

    if (data._embedded?.events) {
      for (const event of data._embedded.events as TicketmasterEvent[]) {
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
        let startDate = '';
        let endDate = '';
        
        if (event.dates?.start?.dateTime) {
          startDate = event.dates.start.dateTime;
        } else if (event.dates?.start?.localDate && event.dates?.start?.localTime) {
          startDate = `${event.dates.start.localDate}T${event.dates.start.localTime}:00`;
        } else if (event.dates?.start?.localDate) {
          startDate = `${event.dates.start.localDate}T20:00:00`;
        }

        if (event.dates?.end?.dateTime) {
          endDate = event.dates.end.dateTime;
        } else if (event.dates?.end?.localDate && event.dates?.end?.localTime) {
          endDate = `${event.dates.end.localDate}T${event.dates.end.localTime}:00`;
        }

        // Get category from classifications
        let category = '';
        if (event.classifications && event.classifications.length > 0) {
          const classification = event.classifications[0];
          const parts = [
            classification.segment?.name,
            classification.genre?.name,
            classification.subGenre?.name
          ].filter(Boolean);
          category = parts.join(' - ');
        }

        // Get best image
        let imageUrl = '';
        if (event.images && event.images.length > 0) {
          // Sort by size and get the largest image
          const sortedImages = event.images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
          imageUrl = sortedImages[0].url;
        }

        // Build venue address
        let address = '';
        if (venue.address?.line1) {
          address = venue.address.line1;
          if (venue.address.line2) {
            address += `, ${venue.address.line2}`;
          }
        }

        const externalEvent: ExternalEvent = {
          id: `ticketmaster-${event.id}`,
          title: event.name,
          starts_at: startDate,
          ends_at: endDate || undefined,
          category: category || undefined,
          description: event.info || undefined,
          image_url: imageUrl || undefined,
          ticket_url: event.url || undefined,
          source: 'ticketmaster',
          venue: {
            id: venue.id,
            name: venue.name,
            address: address || undefined,
            city: venue.city?.name || undefined,
            lat: parseFloat(venue.location.latitude),
            lng: parseFloat(venue.location.longitude),
          }
        };

        events.push(externalEvent);
      }
    }

    console.log(`Processed ${events.length} events from Ticketmaster`);

    return new Response(
      JSON.stringify({ events }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-external-events function:', error);
    // Return empty events but include warning so client UI can continue
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