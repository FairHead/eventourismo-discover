import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SAMPLE_EVENTS = [
  {
    title: "Rock Konzert im Hirsch",
    description: "Lokale Bands präsentieren ihre neuesten Songs im legendären Hirsch",
    event_type: "concert" as const,
    lat: 49.4521,
    lng: 11.0767,
    genres: ["Rock", "Indie"],
    start_utc: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // in 2 days
    end_utc: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), // 3 hours later
    status: "published" as const
  },
  {
    title: "Jazz Night im Mach1",
    description: "Entspannte Jazz-Sounds mitten in der Nürnberger Altstadt",
    event_type: "concert" as const,
    lat: 49.4491,
    lng: 11.0553,
    genres: ["Jazz", "Blues"],
    start_utc: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // in 3 days
    end_utc: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
    status: "published" as const
  },
  {
    title: "Straßenmusik Festival",
    description: "Bunte Mischung aus verschiedenen Acts rund um den Hauptmarkt",
    event_type: "street" as const,
    lat: 49.4536,
    lng: 11.0767,
    genres: ["Folk", "Pop", "World"],
    start_utc: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // in 5 days
    end_utc: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(), // 6 hours later
    status: "published" as const
  },
  {
    title: "Metal Night im Z-Bau",
    description: "Harte Klänge für harte Fans - Metal und Punk im Kulturzentrum",
    event_type: "concert" as const,
    lat: 49.4389,
    lng: 11.0542,
    genres: ["Metal", "Punk"],
    start_utc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // in 7 days
    end_utc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
    status: "published" as const
  }
];

export const useSeedEvents = () => {
  const { user } = useAuth();

  useEffect(() => {
    const seedEvents = async () => {
      if (!user) return;

      try {
        console.log('Seeding sample events...');

        // Delete existing sample events (those with specific titles)
        const eventTitles = SAMPLE_EVENTS.map(e => e.title);
        await supabase
          .from('events')
          .delete()
          .in('title', eventTitles);

        // Create new sample events
        const eventsWithOrganizer = SAMPLE_EVENTS.map(event => ({
          ...event,
          organizer_id: user.id
        }));

        const { error } = await supabase
          .from('events')
          .insert(eventsWithOrganizer);

        if (error) {
          console.error('Error seeding events:', error);
        } else {
          console.log('Successfully seeded sample events in Nürnberg');
        }
      } catch (error) {
        console.error('Error in seedEvents:', error);
      }
    };

    // Run with a small delay to ensure user is fully loaded
    const timer = setTimeout(seedEvents, 1000);
    return () => clearTimeout(timer);
  }, [user]);
};