import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, MapPin, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MapViewProps {
  onPinClick?: (eventId: string) => void;
  events?: EventData[];
  loading?: boolean;
}

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

const MapView: React.FC<MapViewProps> = ({ onPinClick, events = [], loading = false }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapboxReady, setIsMapboxReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);

  // Fetch Mapbox token from Edge Function
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) throw error;
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setTokenError('Mapbox Token nicht gefunden');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        setTokenError('Fehler beim Laden des Mapbox Tokens');
      }
    };

    fetchMapboxToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [13.404954, 52.520008], // Berlin default
      zoom: 12,
      pitch: 45,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setIsMapboxReady(true);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(coords);
          
          if (map.current) {
            map.current.flyTo({
              center: coords,
              zoom: 14,
              duration: 2000
            });
          }
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }, []);
  useEffect(() => {
    if (isMapboxReady && events.length > 0) {
      addEventPins();
    }
  }, [events, isMapboxReady]);

  // Helper function to determine event status
  const getEventStatus = (startUtc: string, endUtc: string): 'live' | 'upcoming' | 'past' => {
    const now = new Date();
    const start = new Date(startUtc);
    const end = new Date(endUtc);

    if (now < start) return 'upcoming';
    if (now > end) return 'past';
    return 'live';
  };

  const clearMarkers = () => {
    markers.forEach(marker => marker.remove());
    setMarkers([]);
  };

  const addEventPins = () => {
    if (!map.current) return;

    // Clear existing markers
    clearMarkers();
    const newMarkers: mapboxgl.Marker[] = [];

    events.forEach((event) => {
      const status = getEventStatus(event.start_utc, event.end_utc);
      const el = document.createElement('div');
      el.className = `event-marker ${status} event`;
      el.innerHTML = `
        <div class="marker-inner ${status === 'live' ? 'animate-pulse' : ''}">
          🎵
        </div>
      `;
      
      el.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${status === 'live' ? '#ef4444' : '#3b82f6'}; 
        border: 2px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      `;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      el.addEventListener('click', () => {
        onPinClick?.(event.id);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([event.lng, event.lat])
        .addTo(map.current!);
      
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Map Container - Lower Z-Index */}
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" style={{ zIndex: 1 }} />

      {/* UI Overlay - Higher Z-Index */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Search & Controls Bar - Centered */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-2 pointer-events-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" style={{ zIndex: 12 }} />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 bg-card/95 backdrop-blur-md border-border shadow-xl"
              style={{ zIndex: 11 }}
            />
          </div>
          <Button 
            variant="secondary" 
            size="icon" 
            className="bg-card/95 backdrop-blur-md border-border shadow-xl"
            style={{ zIndex: 11 }}
          >
            <Filter className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-card/95 backdrop-blur-md border-border shadow-xl"
            style={{ zIndex: 11 }}
            onClick={() => {
              if (userLocation && map.current) {
                map.current.flyTo({
                  center: userLocation,
                  zoom: 14,
                  duration: 1000
                });
              }
            }}
          >
            <MapPin className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats Overlay */}
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl" style={{ zIndex: 11 }}>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">{events.length} Events in der Nähe</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mapbox Token Error/Warning */}
      {(tokenError || !mapboxToken) && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center" style={{ zIndex: 20 }}>
          <div className="bg-card/95 backdrop-blur-md p-6 rounded-lg border border-border shadow-2xl max-w-md text-center">
            <h3 className="text-lg font-semibold mb-2">
              {tokenError || 'Mapbox Token wird geladen...'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {tokenError 
                ? 'Bitte fügen Sie Ihren Mapbox Token in den Supabase Secrets hinzu.'
                : 'Die Karte wird geladen, sobald der Token verfügbar ist.'
              }
            </p>
            {tokenError && (
              <Button 
                variant="default"
                onClick={() => window.location.reload()}
              >
                Neu laden
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;