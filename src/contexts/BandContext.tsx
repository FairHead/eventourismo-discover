import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Band {
  id: string;
  name: string;
  slug: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  country?: string;
}

interface BandContextType {
  activeBand: Band | null;
  userBands: Band[];
  setActiveBand: (band: Band | null) => void;
  refreshUserBands: () => Promise<void>;
  isLoadingBands: boolean;
}

const BandContext = createContext<BandContextType | undefined>(undefined);

export const useBand = () => {
  const context = useContext(BandContext);
  if (context === undefined) {
    throw new Error('useBand must be used within a BandProvider');
  }
  return context;
};

export const BandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeBand, setActiveBand] = useState<Band | null>(null);
  const [userBands, setUserBands] = useState<Band[]>([]);
  const [isLoadingBands, setIsLoadingBands] = useState(false);

  const refreshUserBands = async () => {
    if (!user) {
      setUserBands([]);
      return;
    }

    setIsLoadingBands(true);
    try {
      // Get bands where user is a member or creator
      const { data: memberBands, error: memberError } = await supabase
        .from('band_members')
        .select(`
          bands!inner (
            id,
            name,
            slug,
            avatar_url,
            bio,
            city,
            country
          )
        `)
        .eq('artist_id', user.id)
        .eq('is_active', true);

      if (memberError) throw memberError;

      // Get bands created by user
      const { data: createdBands, error: createdError } = await supabase
        .from('bands')
        .select('id, name, slug, avatar_url, bio, city, country')
        .eq('created_by', user.id)
        .eq('active', true);

      if (createdError) throw createdError;

      // Combine and deduplicate bands
      const allBands = [...(createdBands || [])];
      
      if (memberBands) {
        memberBands.forEach(mb => {
          const band = mb.bands as any;
          if (!allBands.find(b => b.id === band.id)) {
            allBands.push(band);
          }
        });
      }

      setUserBands(allBands);
    } catch (error) {
      console.error('Error fetching user bands:', error);
      setUserBands([]);
    } finally {
      setIsLoadingBands(false);
    }
  };

  useEffect(() => {
    refreshUserBands();
  }, [user]);

  const value = {
    activeBand,
    userBands,
    setActiveBand,
    refreshUserBands,
    isLoadingBands,
  };

  return <BandContext.Provider value={value}>{children}</BandContext.Provider>;
};