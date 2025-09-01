import { SourceId } from './sources';

export interface Venue {
  id: string; // interne, deduplizierte ID
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  sources: Array<{source: SourceId; externalId: string}>;
  events: Event[];
}

export interface Event {
  id: string;            // interne, deduplizierte ID
  title: string;
  startUtc: string;       // ISO
  endUtc?: string;        // ISO
  status?: 'scheduled'|'cancelled'|'postponed'|'live';
  artists?: string[];
  genres?: string[];
  description?: string;
  url?: string;
  imageUrl?: string;
  sources: Array<{source: SourceId; externalId: string; venueExternalId?: string}>;
  venueId: string;       // interne Venue-ID
}