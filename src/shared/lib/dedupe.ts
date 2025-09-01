import { VenueRaw, EventRaw, SourceId } from '@/types/sources';
import { Venue, Event } from '@/types/models';

// Normalize name for comparison
export function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\b(the|club|venue|theater|theatre|hall|arena|center|centre)\b/g, '') // Remove common venue words
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize title for event comparison
export function normalizeTitle(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaro-Winkler similarity algorithm
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  if (matchWindow < 0) return 0.0;

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Identify matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + (0.1 * prefix * (1 - jaro));
}

// Haversine distance in meters
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// Generate deterministic hash
function generateHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString();
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Source priority configuration
const SOURCE_PRIORITY: Record<SourceId, number> = {
  ticketmaster: 1,
  eventbrite: 2
};

// Merge venues with deduplication
export function mergeVenues(venuesRaw: VenueRaw[]): { venues: Venue[], sourceToVenueId: Map<string, string> } {
  const venues: Venue[] = [];
  const sourceToVenueId = new Map<string, string>();
  
  for (const raw of venuesRaw) {
    const normalizedName = normalizeName(raw.name);
    const roundedLat = Math.round(raw.lat * 1000) / 1000;
    const roundedLng = Math.round(raw.lng * 1000) / 1000;
    
    // Find matching existing venue
    let matchingVenue: Venue | null = null;
    
    for (const existing of venues) {
      const existingNormalizedName = normalizeName(existing.name);
      const distance = haversine(raw.lat, raw.lng, existing.lat, existing.lng);
      const nameSimilarity = jaroWinkler(normalizedName, existingNormalizedName);
      
      // Matching criteria
      const geoMatch = distance <= 75; // 75 meters
      const nameMatch = nameSimilarity >= 0.88;
      const addressMatch = raw.address && existing.address && 
        jaroWinkler(raw.address.toLowerCase(), existing.address.toLowerCase()) >= 0.85;
      
      if ((geoMatch && nameMatch) || (nameMatch && addressMatch)) {
        matchingVenue = existing;
        break;
      }
    }
    
    if (matchingVenue) {
      // Merge with existing venue
      matchingVenue.sources.push({ source: raw.source, externalId: raw.externalId });
      
      // Resolve conflicts by priority
      const existingPriority = Math.min(...matchingVenue.sources.map(s => SOURCE_PRIORITY[s.source]));
      const newPriority = SOURCE_PRIORITY[raw.source];
      
      if (newPriority < existingPriority) {
        // New source has higher priority, update fields
        if (raw.phone && !matchingVenue.phone) matchingVenue.phone = raw.phone;
        if (raw.website && !matchingVenue.website) matchingVenue.website = raw.website;
        if (raw.address && (!matchingVenue.address || raw.address.length > matchingVenue.address.length)) {
          matchingVenue.address = raw.address;
        }
      }
      
      sourceToVenueId.set(`${raw.source}:${raw.externalId}`, matchingVenue.id);
    } else {
      // Create new venue
      const venueId = generateHash(`${normalizedName}-${raw.city || ''}-${roundedLat}-${roundedLng}`);
      
      const newVenue: Venue = {
        id: venueId,
        name: raw.name,
        lat: raw.lat,
        lng: raw.lng,
        address: raw.address,
        city: raw.city,
        country: raw.country,
        postalCode: raw.postalCode,
        phone: raw.phone,
        website: raw.website,
        sources: [{ source: raw.source, externalId: raw.externalId }],
        events: []
      };
      
      venues.push(newVenue);
      sourceToVenueId.set(`${raw.source}:${raw.externalId}`, venueId);
    }
  }
  
  return { venues, sourceToVenueId };
}

// Floor time to 15-minute intervals for event matching
function floorTo15Min(date: Date): Date {
  const minutes = date.getMinutes();
  const flooredMinutes = Math.floor(minutes / 15) * 15;
  const result = new Date(date);
  result.setMinutes(flooredMinutes, 0, 0);
  return result;
}

// Merge events with deduplication
export function mergeEvents(eventsRaw: EventRaw[], sourceToVenueId: Map<string, string>): Event[] {
  const events: Event[] = [];
  
  for (const raw of eventsRaw) {
    // Get venue ID
    const venueKey = raw.venueExternalId ? `${raw.source}:${raw.venueExternalId}` : '';
    const venueId = sourceToVenueId.get(venueKey);
    
    if (!venueId) {
      console.warn(`No venue found for event ${raw.externalId} from ${raw.source}`);
      continue;
    }
    
    const normalizedTitle = normalizeTitle(raw.title);
    const startDate = new Date(raw.startUtc);
    const flooredStart = floorTo15Min(startDate);
    
    // Find matching existing event
    let matchingEvent: Event | null = null;
    
    for (const existing of events) {
      if (existing.venueId !== venueId) continue;
      
      const existingStart = new Date(existing.startUtc);
      const timeDiff = Math.abs(startDate.getTime() - existingStart.getTime());
      const titleSimilarity = jaroWinkler(normalizedTitle, normalizeTitle(existing.title));
      
      // Check artist overlap
      const rawArtists = raw.artists || [];
      const existingArtists = existing.artists || [];
      const commonArtists = rawArtists.filter(a => 
        existingArtists.some(ea => jaroWinkler(normalizeName(a), normalizeName(ea)) >= 0.85)
      );
      
      // Matching criteria
      const timeMatch = timeDiff <= 10 * 60 * 1000; // 10 minutes
      const titleMatch = titleSimilarity >= 0.90;
      const artistMatch = normalizedTitle === normalizeTitle(existing.title) && commonArtists.length > 0;
      
      if (timeMatch && (titleMatch || artistMatch)) {
        matchingEvent = existing;
        break;
      }
    }
    
    if (matchingEvent) {
      // Merge with existing event
      matchingEvent.sources.push({ 
        source: raw.source, 
        externalId: raw.externalId, 
        venueExternalId: raw.venueExternalId 
      });
      
      // Resolve conflicts by priority and status
      const existingPriority = Math.min(...matchingEvent.sources.map(s => SOURCE_PRIORITY[s.source]));
      const newPriority = SOURCE_PRIORITY[raw.source];
      
      const statusPriority = { live: 1, scheduled: 2, postponed: 3, cancelled: 4 };
      const existingStatusPrio = statusPriority[matchingEvent.status || 'scheduled'];
      const newStatusPrio = statusPriority[raw.status || 'scheduled'];
      
      // Update status if new one has higher priority
      if (newStatusPrio < existingStatusPrio) {
        matchingEvent.status = raw.status;
      }
      
      // Merge arrays
      if (raw.artists) {
        const existingArtists = matchingEvent.artists || [];
        matchingEvent.artists = [...new Set([...existingArtists, ...raw.artists])];
      }
      
      if (raw.genres) {
        const existingGenres = matchingEvent.genres || [];
        matchingEvent.genres = [...new Set([...existingGenres, ...raw.genres])];
      }
      
      // Use longer description or higher priority source
      if (raw.description) {
        if (!matchingEvent.description || 
            raw.description.length > matchingEvent.description.length ||
            newPriority < existingPriority) {
          matchingEvent.description = raw.description;
        }
      }
      
      // Prefer HTTPS URLs
      if (raw.url) {
        if (!matchingEvent.url || 
            (raw.url.startsWith('https://') && !matchingEvent.url.startsWith('https://')) ||
            newPriority < existingPriority) {
          matchingEvent.url = raw.url;
        }
      }
      
      // Use image from higher priority source
      if (raw.imageUrl && (!matchingEvent.imageUrl || newPriority < existingPriority)) {
        matchingEvent.imageUrl = raw.imageUrl;
      }
      
    } else {
      // Create new event
      const eventId = generateHash(`${venueId}-${flooredStart.toISOString()}-${normalizedTitle}`);
      
      const newEvent: Event = {
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
        sources: [{ 
          source: raw.source, 
          externalId: raw.externalId, 
          venueExternalId: raw.venueExternalId 
        }],
        venueId
      };
      
      events.push(newEvent);
    }
  }
  
  return events;
}