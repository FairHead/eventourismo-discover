import { useState, useCallback } from 'react';
import { Venue, BBox } from '@/types/venues';
import { loadAggregatedVenues, mapBoundsToBBox } from '@/sources/aggregateVenues';
import { toast } from 'sonner';

export const useAggregatedVenues = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAggregatedVenues = useCallback(async (bounds?: {
    getSouthWest(): { lat: number; lng: number };
    getNorthEast(): { lat: number; lng: number };
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      let bbox: BBox | undefined;
      if (bounds) {
        bbox = mapBoundsToBBox(bounds);
      }

      console.log('🚀 Fetching aggregated venues...', bbox);
      
      const aggregatedVenues = await loadAggregatedVenues({ bbox });
      
      console.log(`📍 Loaded ${aggregatedVenues.length} aggregated venues`);
      setVenues(aggregatedVenues);
      
      return aggregatedVenues;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching aggregated venues:', err);
      setError(errorMessage);
      toast.error('Fehler beim Laden der Venues aus externen APIs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clearVenues = useCallback(() => {
    setVenues([]);
    setError(null);
  }, []);

  return {
    venues,
    loading,
    error,
    fetchAggregatedVenues,
    clearVenues,
  };
};