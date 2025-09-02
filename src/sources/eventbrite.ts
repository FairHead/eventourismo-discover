import { VenueRaw, BBox, VenueSearchParams } from '@/types/venues';

const API_BASE = import.meta.env.VITE_EVENTBRITE_BASE_URL || 'https://www.eventbriteapi.com/v3';

export async function fetchEventbriteVenues(params: VenueSearchParams): Promise<VenueRaw[]> {
  const token = import.meta.env.VITE_EVENTBRITE_OAUTH_TOKEN;
  
  if (!token) {
    console.warn('Eventbrite OAuth token not found in environment variables');
    return [];
  }

  try {
    // Eventbrite doesn't have a direct venues endpoint, so we fetch events and extract unique venues
    const url = new URL(`${API_BASE}/events/search/`);
    url.searchParams.set('expand', 'venue');
    url.searchParams.set('location.address', 'Germany');
    url.searchParams.set('location.within', '50km');
    
    if (params.bbox) {
      // Use bbox center as location point
      const centerLat = (params.bbox.minLat + params.bbox.maxLat) / 2;
      const centerLng = (params.bbox.minLng + params.bbox.maxLng) / 2;
      url.searchParams.set('location.latitude', centerLat.toString());
      url.searchParams.set('location.longitude', centerLng.toString());
      
      // Calculate radius to cover bbox
      const radius = Math.max(
        Math.abs(params.bbox.maxLat - params.bbox.minLat) * 111,
        Math.abs(params.bbox.maxLng - params.bbox.minLng) * 85
      ) / 2;
      url.searchParams.set('location.within', `${Math.ceil(radius)}km`);
    }

    console.log('🎪 Fetching Eventbrite venues via events endpoint:', url.toString().replace(token, 'TOKEN'));

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      console.error('Eventbrite API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (!data.events || data.events.length === 0) {
      console.log('🎪 No Eventbrite events with venues found');
      return [];
    }

    // Extract unique venues from events
    const venueMap = new Map<string, VenueRaw>();
    
    data.events.forEach((event: any) => {
      const venue = event.venue;
      if (!venue || !venue.id || !venue.latitude || !venue.longitude) return;

      // Only add if not already processed
      if (!venueMap.has(venue.id)) {
        const venueData: VenueRaw = {
          source: 'eventbrite' as const,
          externalId: venue.id,
          name: venue.name || 'Unknown Venue',
          lat: parseFloat(venue.latitude),
          lng: parseFloat(venue.longitude),
          address: venue.address ? [
            venue.address.address_1,
            venue.address.address_2
          ].filter(Boolean).join(', ') : undefined,
          city: venue.address?.city,
          postalCode: venue.address?.postal_code,
          country: venue.address?.country === 'DE' ? 'Deutschland' : venue.address?.country,
          category: 'venue',
        };
        
        venueMap.set(venue.id, venueData);
      }
    });

    const venues = Array.from(venueMap.values());
    console.log(`🎪 Found ${venues.length} unique Eventbrite venues from ${data.events.length} events`);
    return venues;
    
  } catch (error) {
    console.error('Error fetching Eventbrite venues:', error);
    return [];
  }
}