-- Fix security issues: Move extensions to extensions schema and fix function search paths

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move extensions to extensions schema
DROP EXTENSION IF EXISTS cube CASCADE;
DROP EXTENSION IF EXISTS earthdistance CASCADE;
CREATE EXTENSION IF NOT EXISTS cube WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS earthdistance WITH SCHEMA extensions;

-- Recreate venue deduplication function with proper security settings
CREATE OR REPLACE FUNCTION public.venues_find_candidates(
  v_name text, 
  v_lat float8, 
  v_lon float8, 
  v_radius_m int DEFAULT 80
) RETURNS SETOF public.venues 
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT * FROM public.venues
  WHERE lower(name) = lower(v_name)
     OR extensions.earth_distance(extensions.ll_to_earth(lat, lng), extensions.ll_to_earth(v_lat, v_lon)) < v_radius_m;
$$;

-- Recreate indexes with proper schema references
DROP INDEX IF EXISTS venues_geo_idx;
CREATE INDEX venues_geo_idx ON public.venues USING gist (extensions.ll_to_earth(lat, lng));