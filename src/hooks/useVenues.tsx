import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type VenueRow = Database['public']['Tables']['venues']['Row'];

export interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  categories?: string[] | null;
  sources?: any; // JSON field - can be array of objects or other JSON
  created_at: string;
  updated_at: string;
  created_by: string;
  description?: string | null;
  hero_image_url?: string | null;
  opening_hours?: any | null; // JSON field
  phone?: string | null;
  socials?: any | null; // JSON field
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const useVenues = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVenues = useCallback(async (bbox?: BoundingBox) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('venues')
        .select('*')
        .order('name');

      // Apply bounding box filter if provided
      if (bbox) {
        query = query
          .gte('lat', bbox.south)
          .lte('lat', bbox.north)
          .gte('lng', bbox.west)
          .lte('lng', bbox.east);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching venues:', fetchError);
        setError(fetchError.message);
        toast.error('Fehler beim Laden der Venues');
        return [];
      }

      console.log(`Loaded ${data?.length || 0} venues from database`);
      setVenues(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in fetchVenues:', err);
      setError(errorMessage);
      toast.error('Fehler beim Laden der Venues');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getVenueById = useCallback(async (id: string): Promise<Venue | null> => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching venue by ID:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error in getVenueById:', err);
      return null;
    }
  }, []);

  const searchVenues = useCallback(async (searchTerm: string, bbox?: BoundingBox): Promise<Venue[]> => {
    try {
      let query = supabase
        .from('venues')
        .select('*')
        .or(`name.ilike.%${searchTerm}%, city.ilike.%${searchTerm}%, address.ilike.%${searchTerm}%`)
        .order('name');

      // Apply bounding box filter if provided
      if (bbox) {
        query = query
          .gte('lat', bbox.south)
          .lte('lat', bbox.north)
          .gte('lng', bbox.west)
          .lte('lng', bbox.east);
      }

      const { data, error } = await query.limit(20);

      if (error) {
        console.error('Error searching venues:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error in searchVenues:', err);
      return [];
    }
  }, []);

  // Load venues on mount
  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  return {
    venues,
    loading,
    error,
    fetchVenues,
    getVenueById,
    searchVenues,
    refetch: fetchVenues
  };
};