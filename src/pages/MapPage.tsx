import React, { useState, useEffect } from 'react';
import MapView from '@/components/MapView';
import InfoPanel from '@/components/InfoPanel';
import EventCreateModal from '@/components/EventCreateModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventData {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_utc: string;
  end_utc: string;
  lat: number;
  lng: number;
  organizer_id: string;
  band_id?: string;
  genres: string[];
  website_url?: string;
  ticket_url?: string;
  status: string;
  bands?: {
    name: string;
    avatar_url?: string;
  };
  users?: {
    display_name?: string;
    username?: string;
  };
}

const MapPage: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            users (
              display_name,
              username
            )
          `)
          .eq('status', 'published')
          .gte('end_utc', new Date().toISOString())
          .order('start_utc', { ascending: true });

        if (error) throw error;

        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast({
          title: "Fehler",
          description: "Events konnten nicht geladen werden",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Set up real-time subscription for new events
    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events'
        },
        () => {
          fetchEvents(); // Refetch events when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const handlePinClick = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handlePanelClose = () => {
    setSelectedEventId(null);
  };

  const handleEventCreated = () => {
    // Refetch events when a new event is created
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            users (
              display_name,
              username
            )
          `)
          .eq('status', 'published')
          .gte('end_utc', new Date().toISOString())
          .order('start_utc', { ascending: true });

        if (error) throw error;

        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents();
  };

  const selectedEvent = selectedEventId ? events.find(event => event.id === selectedEventId) : undefined;

  // Transform event data for InfoPanel compatibility
  const transformedEventData = selectedEvent ? {
    id: selectedEvent.id,
    title: selectedEvent.title,
    subtitle: `${selectedEvent.event_type} • ${selectedEvent.bands?.name || 'Solo'}`,
    type: 'event' as const,
    status: getEventStatus(selectedEvent.start_utc, selectedEvent.end_utc),
    startTime: new Date(selectedEvent.start_utc).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    endTime: new Date(selectedEvent.end_utc).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    location: `Lat: ${selectedEvent.lat.toFixed(4)}, Lng: ${selectedEvent.lng.toFixed(4)}`,
    genres: selectedEvent.genres,
    description: selectedEvent.description || '',
    images: [], // TODO: Add image support later
    ticketUrl: selectedEvent.ticket_url,
    websiteUrl: selectedEvent.website_url,
    rating: 0, // TODO: Add rating system later
    attendees: 0, // TODO: Add attendees system later
    isFavorite: false, // TODO: Add favorites system later
  } : undefined;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <MapView 
        onPinClick={handlePinClick} 
        events={events}
        loading={loading}
      />
      
      {/* Floating Create Event Button */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <InfoPanel 
        isOpen={!!selectedEventId}
        onClose={handlePanelClose}
        eventData={transformedEventData}
      />
      
      <EventCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};

// Helper function to determine event status
function getEventStatus(startUtc: string, endUtc: string): 'live' | 'upcoming' | 'past' {
  const now = new Date();
  const start = new Date(startUtc);
  const end = new Date(endUtc);

  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'live';
}

export default MapPage;