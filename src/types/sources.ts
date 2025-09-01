export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TimeRange {
  startIso?: string;
  endIso?: string;
}

export interface VenueRaw {
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

export interface EventRaw {
  source: SourceId;
  externalId: string;
  venueExternalId?: string;
  title: string;
  startUtc: string;       // ISO
  endUtc?: string;        // ISO
  status?: 'scheduled'|'cancelled'|'postponed'|'live';
  artists?: string[];
  genres?: string[];
  description?: string;
  url?: string;
  imageUrl?: string;
}

export type SourceId = 'ticketmaster' | 'eventbrite';

export interface EventSource {
  id: SourceId;
  fetchVenues(params: { bbox?: BBox; updatedSince?: string }): Promise<VenueRaw[]>;
  fetchEvents(params: { bbox?: BBox; timeRange?: TimeRange; updatedSince?: string }): Promise<EventRaw[]>;
}