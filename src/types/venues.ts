export type SourceId = 'ticketmaster' | 'eventbrite' | 'eventourismo' | 'osm';

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface VenueRaw {
  source: SourceId;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  category?: string;
  website?: string;
  phone?: string;
  description?: string;
}

export interface Venue extends Omit<VenueRaw, 'source' | 'externalId'> {
  id: string; // internal ID (hash from name+geo)
  sources: Array<{ source: SourceId; externalId: string }>;
}

export interface VenueSearchParams {
  bbox?: BBox;
  updatedSince?: string;
  limit?: number;
}