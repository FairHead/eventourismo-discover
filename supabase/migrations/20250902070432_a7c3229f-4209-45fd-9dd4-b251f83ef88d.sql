-- Extensions for geospatial operations
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Add columns to public.venues if they don't exist
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS sources jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS categories text[],
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS country text;

-- Add sources column to public.events if it doesn't exist
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS sources jsonb DEFAULT '[]'::jsonb;

-- Helper function for venue deduplication
-- Finds candidates by name similarity OR distance < radius
CREATE OR REPLACE FUNCTION public.venues_find_candidates(
  v_name text, 
  v_lat float8, 
  v_lon float8, 
  v_radius_m int DEFAULT 80
) RETURNS SETOF public.venues 
LANGUAGE SQL STABLE
SET search_path = public
AS $$
  SELECT * FROM public.venues
  WHERE lower(name) = lower(v_name)
     OR earth_distance(ll_to_earth(lat, lng), ll_to_earth(v_lat, v_lon)) < v_radius_m;
$$;

-- Geospatial index for efficient distance queries
CREATE INDEX IF NOT EXISTS venues_geo_idx ON public.venues USING gist (ll_to_earth(lat, lng));

-- Name index for efficient text searches
CREATE INDEX IF NOT EXISTS venues_name_idx ON public.venues ((lower(name)));

-- Sources index for efficient source queries
CREATE INDEX IF NOT EXISTS venues_sources_idx ON public.venues USING gin (sources);