import { VenueRaw, BBox, VenueSearchParams } from '@/types/venues';

const API_BASE = 'https://app.ticketmaster.com/discovery/v2';

export async function fetchTicketmasterVenues(params: VenueSearchParams): Promise<VenueRaw[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;
  
  if (!apiKey) {
    console.warn('Ticketmaster API key not found in environment variables');
    return [];
  }

  try {
    const url = new URL(`${API_BASE}/venues.json`);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('countryCode', 'DE');
    url.searchParams.set('size', '200');
    
    if (params.bbox) {
      // Ticketmaster uses geoPoint format: lat,lng,radius
      const centerLat = (params.bbox.minLat + params.bbox.maxLat) / 2;
      const centerLng = (params.bbox.minLng + params.bbox.maxLng) / 2;
      // Calculate approximate radius in km for bbox coverage
      const radius = Math.max(
        Math.abs(params.bbox.maxLat - params.bbox.minLat) * 111,
        Math.abs(params.bbox.maxLng - params.bbox.minLng) * 85
      ) / 2;
      url.searchParams.set('geoPoint', `${centerLat},${centerLng},${Math.ceil(radius)}km`);
    }

    console.log('🎫 Fetching Ticketmaster venues:', url.toString().replace(apiKey, 'API_KEY'));

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error('Ticketmaster API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (!data._embedded?.venues) {
      console.log('🎫 No Ticketmaster venues found');
      return [];
    }

    const venues: VenueRaw[] = data._embedded.venues
      .filter((venue: any) => venue.location?.latitude && venue.location?.longitude)
      .map((venue: any) => ({
        source: 'ticketmaster' as const,
        externalId: venue.id,
        name: venue.name || 'Unknown Venue',
        lat: parseFloat(venue.location.latitude),
        lng: parseFloat(venue.location.longitude),
        address: venue.address ? [
          venue.address.line1,
          venue.address.line2
        ].filter(Boolean).join(', ') : undefined,
        city: venue.city?.name,
        postalCode: venue.postalCode,
        country: venue.country?.countryCode === 'DE' ? 'Deutschland' : venue.country?.name,
        website: venue.url,
        category: venue.classifications?.[0]?.segment?.name || 'venue',
        description: venue.generalInfo?.generalRule,
      }));

    console.log(`🎫 Found ${venues.length} Ticketmaster venues`);
    return venues;
    
  } catch (error) {
    console.error('Error fetching Ticketmaster venues:', error);
    return [];
  }
}