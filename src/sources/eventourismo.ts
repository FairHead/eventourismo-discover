import { VenueRaw, BBox, VenueSearchParams } from '@/types/venues';

const API_BASE = import.meta.env.VITE_EVENTOURISMO_BASE_URL || 'https://api.eventourismo.de/api/v1';

export async function fetchEventourismoVenues(params: VenueSearchParams): Promise<VenueRaw[]> {
  const apiKey = import.meta.env.VITE_EVENTOURISMO_API_KEY;
  const clientSecret = import.meta.env.VITE_EVENTOURISMO_CLIENT_SECRET;
  const privateToken = import.meta.env.VITE_EVENTOURISMO_PRIVATE_TOKEN;
  
  if (!apiKey || !clientSecret) {
    console.warn('Eventourismo API credentials not found in environment variables');
    return [];
  }

  try {
    const url = new URL(`${API_BASE}/venues`);
    
    if (params.bbox) {
      url.searchParams.set('bbox', `${params.bbox.minLng},${params.bbox.minLat},${params.bbox.maxLng},${params.bbox.maxLat}`);
    }
    
    if (params.limit) {
      url.searchParams.set('limit', params.limit.toString());
    }

    console.log('🏛️ Fetching Eventourismo venues:', url.toString().replace(apiKey, 'API_KEY'));

    const headers: Record<string, string> = {
      'X-API-Key': apiKey,
      'X-Client-Secret': clientSecret,
      'Content-Type': 'application/json',
    };
    
    if (privateToken) {
      headers['Authorization'] = `Bearer ${privateToken}`;
    }

    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      console.error('Eventourismo API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log('🏛️ No Eventourismo venues found');
      return [];
    }

    const venues: VenueRaw[] = data.data
      .filter((venue: any) => venue.latitude && venue.longitude)
      .map((venue: any) => ({
        source: 'eventourismo' as const,
        externalId: venue.id?.toString() || venue.slug,
        name: venue.name || venue.title || 'Unknown Venue',
        lat: parseFloat(venue.latitude),
        lng: parseFloat(venue.longitude),
        address: venue.address || venue.street,
        city: venue.city,
        postalCode: venue.postal_code || venue.zip,
        country: venue.country || 'Deutschland',
        website: venue.website || venue.url,
        phone: venue.phone,
        category: venue.category || venue.type || 'venue',
        description: venue.description || venue.about,
      }));

    console.log(`🏛️ Found ${venues.length} Eventourismo venues`);
    return venues;
    
  } catch (error) {
    console.error('Error fetching Eventourismo venues:', error);
    return [];
  }
}