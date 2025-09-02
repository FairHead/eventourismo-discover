import { VenueRaw, Venue, SourceId } from '@/types/venues';

/**
 * Normalize venue name for comparison
 * Removes diacritics, common venue words, and special characters
 */
export function normalizeName(str: string): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\b(club|bar|theater|theatre|venue|hall|arena|center|centre|stadium|kino|cinema|restaurant|cafe|café|gasthaus|hotel)\b/g, '')
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a score between 0 and 1 (1 = identical)
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  if (matchWindow < 0) return 0;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Find transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Jaro-Winkler bonus for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + (0.1 * prefix * (1 - jaro));
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Create a hash for venue identification
 */
export function hashVenue(venue: VenueRaw): string {
  const normalized = normalizeName(venue.name);
  const coords = `${Math.round(venue.lat * 1000)}${Math.round(venue.lng * 1000)}`;
  const city = venue.city?.toLowerCase().replace(/[^\w]/g, '') || '';
  return btoa(`${normalized}_${city}_${coords}`).replace(/[+/=]/g, '').slice(0, 12);
}

/**
 * Check if two venues are likely the same venue
 */
export function areSameVenue(v1: VenueRaw, v2: VenueRaw): boolean {
  // Distance check (75m threshold)
  const distance = haversine(v1.lat, v1.lng, v2.lat, v2.lng);
  if (distance > 0.075) return false;

  // Name similarity check
  const norm1 = normalizeName(v1.name);
  const norm2 = normalizeName(v2.name);
  const similarity = jaroWinkler(norm1, norm2);
  
  // High similarity threshold for name matching
  if (similarity < 0.88) return false;

  // Optional: Address similarity for same city
  if (v1.city && v2.city) {
    const sameCity = normalizeName(v1.city) === normalizeName(v2.city);
    if (!sameCity) return false;
  }

  return true;
}

/**
 * Merge source arrays, avoiding duplicates by source:id combination
 */
export function mergeSources(
  existingSources: Array<{ source: SourceId; externalId: string }> = [],
  newSources: Array<{ source: SourceId; externalId: string }> = []
): Array<{ source: SourceId; externalId: string }> {
  const sourceMap = new Map<string, { source: SourceId; externalId: string }>();
  
  // Add existing sources first
  existingSources.forEach(source => {
    if (source?.source && source?.externalId) {
      sourceMap.set(`${source.source}:${source.externalId}`, source);
    }
  });
  
  // Add new sources, overwriting if same key
  newSources.forEach(source => {
    if (source?.source && source?.externalId) {
      sourceMap.set(`${source.source}:${source.externalId}`, source);
    }
  });
  
  return Array.from(sourceMap.values());
}

/**
 * Get a better venue name by preferring longer, more descriptive names
 */
export function getBetterName(name1: string, name2: string): string {
  if (!name1) return name2;
  if (!name2) return name1;
  
  // Prefer longer names that are likely more descriptive
  if (name2.length > name1.length + 5) {
    return name2;
  }
  
  return name1;
}

/**
 * Get better venue data by merging and preferring higher quality sources
 */
export function mergeBetterVenueData(existing: VenueRaw, incoming: VenueRaw): VenueRaw {
  // Source priority: OSM > Eventourismo > Ticketmaster > Eventbrite
  const sourcePriority: Record<string, number> = {
    osm: 4,
    eventourismo: 3,
    ticketmaster: 2,
    eventbrite: 1
  };

  const existingPrio = sourcePriority[existing.source] || 0;
  const incomingPrio = sourcePriority[incoming.source] || 0;

  // Use higher priority source as base, fill missing fields from lower priority
  const primary = incomingPrio > existingPrio ? incoming : existing;
  const secondary = incomingPrio > existingPrio ? existing : incoming;

  return {
    ...secondary, // Use secondary as base for missing fields
    ...primary, // Override with primary source data
    name: getBetterName(primary.name, secondary.name),
    address: primary.address || secondary.address,
    city: primary.city || secondary.city,
    postalCode: primary.postalCode || secondary.postalCode,
    country: primary.country || secondary.country,
    website: primary.website || secondary.website,
    phone: primary.phone || secondary.phone,
    description: primary.description || secondary.description,
  };
}

/**
 * Deduplicate venues and merge sources
 * Returns deduplicated venues with merged source information
 */
export function dedupeVenues(venues: VenueRaw[]): Venue[] {
  const result: Venue[] = [];
  const processed = new Set<number>();

  console.log(`🔄 Deduplicating ${venues.length} venues...`);

  for (let i = 0; i < venues.length; i++) {
    if (processed.has(i)) continue;

    const currentVenue = venues[i];
    const duplicates: number[] = [];

    // Find all duplicates for this venue
    for (let j = i + 1; j < venues.length; j++) {
      if (processed.has(j)) continue;
      
      if (areSameVenue(currentVenue, venues[j])) {
        duplicates.push(j);
      }
    }

    // Mark duplicates as processed
    duplicates.forEach(idx => processed.add(idx));

    // Merge venue data from all duplicates
    let mergedVenue = currentVenue;
    const allSources: Array<{ source: SourceId; externalId: string }> = [{ source: currentVenue.source, externalId: currentVenue.externalId }];

    duplicates.forEach(idx => {
      const duplicate = venues[idx];
      mergedVenue = mergeBetterVenueData(mergedVenue, duplicate);
      allSources.push({ source: duplicate.source, externalId: duplicate.externalId });
    });

    // Create final venue object
    const venue: Venue = {
      id: hashVenue(mergedVenue),
      name: mergedVenue.name,
      lat: mergedVenue.lat,
      lng: mergedVenue.lng,
      address: mergedVenue.address,
      city: mergedVenue.city,
      postalCode: mergedVenue.postalCode,
      country: mergedVenue.country,
      category: mergedVenue.category,
      website: mergedVenue.website,
      phone: mergedVenue.phone,
      description: mergedVenue.description,
      sources: mergeSources([], allSources)
    };

    result.push(venue);

    if (duplicates.length > 0) {
      console.log(`📍 Merged venue "${venue.name}" from ${allSources.length} sources:`, 
        allSources.map(s => s.source).join(', '));
    }
  }

  const duplicateCount = venues.length - result.length;
  console.log(`✅ Deduplication complete: ${result.length} unique venues (removed ${duplicateCount} duplicates)`);

  return result;
}