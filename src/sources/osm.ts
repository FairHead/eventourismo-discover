import { VenueRaw, BBox, VenueSearchParams } from '@/types/venues';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

export async function fetchOsmVenues(params: VenueSearchParams): Promise<VenueRaw[]> {
  try {
    const bbox = params.bbox;
    if (!bbox) {
      console.warn('OSM venues fetch requires bounding box');
      return [];
    }

    const { minLat, minLng, maxLat, maxLng } = bbox;

    // Overpass QL query for discos and music event locations only
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(music_venue|concert_hall|nightclub)$"](${minLat},${minLng},${maxLat},${maxLng});
        node["leisure"~"^(dance)$"](${minLat},${minLng},${maxLat},${maxLng});
        node["club"~"^(music|nightclub)$"](${minLat},${minLng},${maxLat},${maxLng});
        way["amenity"~"^(music_venue|concert_hall|nightclub)$"](${minLat},${minLng},${maxLat},${maxLng});
        way["leisure"~"^(dance)$"](${minLat},${minLng},${maxLat},${maxLng});
        way["club"~"^(music|nightclub)$"](${minLat},${minLng},${maxLat},${maxLng});
        relation["amenity"~"^(music_venue|concert_hall|nightclub)$"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out center;
    `;

    console.log('🗺️ Fetching OSM venues for bbox:', { minLat, minLng, maxLat, maxLng });

    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: query,
    });

    if (!response.ok) {
      console.error('OSM Overpass API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (!data.elements || data.elements.length === 0) {
      console.log('🗺️ No OSM venues found in area');
      return [];
    }

    const venues: VenueRaw[] = data.elements
      .filter((element: any) => {
        // Filter out elements without proper coordinates or name
        if (!element.tags?.name) return false;
        
        // For nodes, use lat/lon directly
        if (element.type === 'node') {
          return element.lat && element.lon;
        }
        
        // For ways and relations, use center if available
        if (element.center) {
          return element.center.lat && element.center.lon;
        }
        
        return false;
      })
      .map((element: any) => {
        // Get coordinates - use center for ways/relations, direct lat/lon for nodes
        const lat = element.type === 'node' ? element.lat : element.center?.lat;
        const lng = element.type === 'node' ? element.lon : element.center?.lon;
        
        // Determine category from OSM tags
        const amenity = element.tags.amenity;
        const leisure = element.tags.leisure;
        const tourism = element.tags.tourism;
        const shop = element.tags.shop;
        
        let category = 'music';
        if (amenity) {
          if (['music_venue', 'concert_hall'].includes(amenity)) {
            category = 'music_venue';
          } else if (['nightclub'].includes(amenity)) {
            category = 'nightclub';
          }
        } else if (leisure) {
          if (['dance'].includes(leisure)) {
            category = 'dance_club';
          }
        } else if (element.tags.club) {
          category = element.tags.club === 'nightclub' ? 'nightclub' : 'music_venue';
        }

        return {
          source: 'osm' as const,
          externalId: `${element.type}_${element.id}`,
          name: element.tags.name || 'Unknown Venue',
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address: [
            element.tags['addr:street'],
            element.tags['addr:housenumber']
          ].filter(Boolean).join(' ') || undefined,
          city: element.tags['addr:city'],
          postalCode: element.tags['addr:postcode'],
          country: element.tags['addr:country'] || 'Deutschland',
          website: element.tags.website || element.tags['contact:website'],
          phone: element.tags.phone || element.tags['contact:phone'],
          category,
          description: element.tags.description,
        };
      });

    console.log(`🗺️ Found ${venues.length} OSM venues`);
    return venues;
    
  } catch (error) {
    console.error('Error fetching OSM venues:', error);
    return [];
  }
}