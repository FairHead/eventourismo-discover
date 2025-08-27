import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
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
  const [currentMapPosition, setCurrentMapPosition] = useState<{center: [number, number], zoom: number} | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
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
    // Keep the event panel open by keeping selectedEventId - the updated data will load automatically
  };

  const handleMapReady = (mapInstance: mapboxgl.Map) => {
    // Validate that mapInstance is a proper Mapbox GL Map instance
    if (!mapInstance || typeof mapInstance.on !== 'function') {
      console.error('Invalid map instance received:', mapInstance);
      return;
    }

    setMapInstance(mapInstance);
    
    // Update map position when map moves
    const updatePosition = () => {
      if (!mapInstance || typeof mapInstance.getCenter !== 'function') return;
      
      try {
        const center = mapInstance.getCenter();
        const zoom = mapInstance.getZoom();
        setCurrentMapPosition({ center: [center.lng, center.lat], zoom });
      } catch (error) {
        console.warn('Error updating map position:', error);
      }
    };
    
    // Listen for map movements with error handling
    try {
      mapInstance.on('moveend', updatePosition);
      mapInstance.on('zoomend', updatePosition);
      
      // Set initial position
      updatePosition();
    } catch (error) {
      console.error('Error setting up map event listeners:', error);
    }
  };

  const calculateRoute = async (destination: [number, number], mode: 'walking' | 'cycling' | 'driving') => {
    if (!currentMapPosition || !mapInstance) {
      throw new Error('Map not ready');
    }

    const userLocation = currentMapPosition.center;
    
    try {
      // Get Mapbox token
      const { data: tokenData, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;

      const profile = mode === 'cycling' ? 'cycling' : 
                    mode === 'walking' ? 'walking' : 'driving';
      
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${userLocation[0]},${userLocation[1]};${destination[0]},${destination[1]}?` +
        `steps=true&geometries=geojson&access_token=${tokenData.token}&language=de`
      );

      if (!response.ok) throw new Error('Route calculation failed');

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Display route on map
        displayRoute(route);
        
        // Fit map to show entire route
        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        mapInstance.fitBounds(bounds, { padding: 50 });
        
        return {
          duration: route.duration,
          distance: route.distance,
          steps: route.legs[0]?.steps || []
        };
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      throw error;
    }
  };

  const displayRoute = (route: any) => {
    if (!mapInstance) return;

    // Remove existing route
    clearRoute();

    const routeId = 'route-' + Date.now();

    // Add route source
    mapInstance.addSource(routeId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });

    // Add route outline for better visibility
    mapInstance.addLayer({
      id: routeId + '-outline',
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': 8,
        'line-opacity': 0.8
      }
    });

    // Add route layer
    mapInstance.addLayer({
      id: routeId,
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#007AFF',
        'line-width': 5,
        'line-opacity': 1
      }
    });
  };

  const clearRoute = () => {
    if (!mapInstance) return;

    // Remove all existing route layers
    const style = mapInstance.getStyle();
    if (style && style.layers) {
      style.layers.forEach((layer: any) => {
        if (layer.id.startsWith('route-')) {
          try {
            mapInstance.removeLayer(layer.id);
            if (mapInstance.getSource(layer.source)) {
              mapInstance.removeSource(layer.source);
            }
          } catch (error) {
            console.warn('Error removing route layer:', error);
          }
        }
      });
    }
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
    location: `${selectedEvent.lat}, ${selectedEvent.lng}`,
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
        onMapReady={handleMapReady}
        selectedEventId={selectedEventId}
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
        onCalculateRoute={calculateRoute}
        userLocation={currentMapPosition?.center || null}
      />
      
      <EventCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={handleEventCreated}
        initialMapPosition={currentMapPosition}
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
function getEventStatus(startUtc: string, endUtc: string): 'upcoming' | 'starting_soon' | 'live' | 'ending_soon' | 'finished' | 'past' {
  const now = new Date();
  const start = new Date(startUtc);
  const end = new Date(endUtc);

  // Calculate time differences in minutes
  const minutesToStart = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
  const minutesToEnd = Math.floor((end.getTime() - now.getTime()) / (1000 * 60));
  const minutesSinceEnd = Math.floor((now.getTime() - end.getTime()) / (1000 * 60));

  // Event hasn't started yet
  if (now < start) {
    // 3 hours before start = 180 minutes
    if (minutesToStart <= 180) {
      return 'starting_soon'; // Orange - beginnt bald
    }
    return 'upcoming'; // Blue - bevorstehend
  }
  
  // Event is currently happening
  if (now >= start && now <= end) {
    // 5 minutes before end
    if (minutesToEnd <= 5) {
      return 'ending_soon'; // Yellow - endet bald
    }
    return 'live'; // Green - läuft gerade
  }
  
  // Event has ended
  if (now > end) {
    // 3 hours after end = 180 minutes
    if (minutesSinceEnd <= 180) {
      return 'finished'; // Red - beendet
    }
    return 'past'; // Should be removed from map
  }
  
  return 'upcoming';
}

export default MapPage;