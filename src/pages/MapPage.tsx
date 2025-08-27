import React, { useState, useEffect } from 'react';
import MapView from '@/components/MapView';
import InfoPanel from '@/components/InfoPanel';
import EventCreateModal from '@/components/EventCreateModal';
import EventEditModal from '@/components/EventEditModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  venues?: {
    name: string;
  };
}

const MapPage: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          users (
            display_name,
            username
          ),
          bands (
            name,
            avatar_url
          ),
          venues (
            name
          )
        `)
        .eq('status', 'published')
        .gte('end_utc', new Date().toISOString())
        .order('start_utc', { ascending: true });

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error("Events konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const refetchEvents = () => {
    fetchEvents();
  };

  useEffect(() => {
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
  }, []);

  const handlePinClick = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handlePanelClose = () => {
    setSelectedEventId(null);
  };

  const handleEventCreated = () => {
    refetchEvents();
    setShowCreateModal(false);
  };

  const handleEditEvent = (eventId: string) => {
    setEditEventId(eventId);
    setShowEditModal(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setDeleteEventId(eventId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteEvent = async () => {
    if (!deleteEventId) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteEventId);

      if (error) {
        console.error('Error deleting event:', error);
        toast.error('Fehler beim Löschen des Events');
        return;
      }

      toast.success('Event wurde erfolgreich gelöscht');
      refetchEvents();
      setSelectedEventId(null);
      setShowDeleteDialog(false);
      setDeleteEventId(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    }
  };

  const handleEventUpdated = () => {
    refetchEvents();
    setShowEditModal(false);
    setEditEventId(null);
  };

  const selectedEvent = selectedEventId ? events.find(event => event.id === selectedEventId) : undefined;

  // Transform event data for InfoPanel compatibility
  const transformedEventData = selectedEvent ? {
    id: selectedEvent.id,
    title: selectedEvent.title,
    subtitle: selectedEvent.bands?.name || 'Event',
    type: 'event' as const,
    status: getEventStatus(selectedEvent.start_utc, selectedEvent.end_utc),
    startTime: selectedEvent.start_utc,
    endTime: selectedEvent.end_utc,
    location: selectedEvent.venues?.name || `${selectedEvent.lat}, ${selectedEvent.lng}`,
    genres: selectedEvent.genres || [],
    description: selectedEvent.description || 'Keine Beschreibung verfügbar',
    images: [], // TODO: Add image support later
    ticketUrl: selectedEvent.ticket_url,
    websiteUrl: selectedEvent.website_url,
    rating: Math.random() * 2 + 3, // Mock rating
    attendees: Math.floor(Math.random() * 200) + 50, // Mock attendees
    isFavorite: Math.random() > 0.5, // Mock favorite status
    organizerId: selectedEvent.organizer_id,
  } : null;

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
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />
      
      <EventCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={handleEventCreated}
      />

      <EventEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        eventId={editEventId || ''}
        onEventUpdated={handleEventUpdated}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie dieses Event löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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