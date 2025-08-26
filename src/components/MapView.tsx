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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  // Removed Mapbox popup state to avoid duplicate UI

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
      
      // Create marker with inner content to avoid overriding Mapbox transforms
      const el = document.createElement('div');
      el.setAttribute('data-event-id', event.id);
      el.style.cursor = 'pointer';
      el.style.zIndex = '100';

      const inner = document.createElement('div');
      inner.style.width = '32px';
      inner.style.height = '32px';
      inner.style.borderRadius = '50%';
      inner.style.display = 'flex';
      inner.style.alignItems = 'center';
      inner.style.justifyContent = 'center';
      inner.style.fontSize = '16px';
      inner.style.userSelect = 'none';
      inner.style.border = '2px solid white';
      inner.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      inner.style.transition = 'transform 0.2s ease';
      inner.style.transformOrigin = 'center center';
      inner.style.willChange = 'transform';
      inner.textContent = '🎵';

      // Set background color based on status
      if (status === 'live') {
        inner.style.backgroundColor = '#ef4444';
        inner.style.animation = 'pulse 2s infinite';
      } else if (status === 'upcoming') {
        inner.style.backgroundColor = '#3b82f6';
      } else {
        inner.style.backgroundColor = '#6b7280';
      }

      el.appendChild(inner);

      // Hover effects on inner content only (do NOT modify outer transform)
      el.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        inner.style.transform = 'scale(1.2)';
        el.style.zIndex = '200';
      });

      el.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        inner.style.transform = 'scale(1)';
        el.style.zIndex = '100';
      });

      // Click handler: only open side sheet, no Mapbox popup to avoid duplicate UI
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        onPinClick?.(event.id);
      });

      // Create marker with center anchor to prevent positioning issues
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        offset: [0, 0]
      })
        .setLngLat([event.lng, event.lat])
        .addTo(map.current!);
      
      newMarkers.push(marker);
      
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  };

  // Search function using Mapbox Geocoding API
  const handleSearch = async (query: string) => {
    if (!query.trim() || !mapboxToken) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=5&language=de`
      );
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setSearchResults(data.features || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  // Handle search input changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length > 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, mapboxToken]);

  // Navigate to selected location
  const navigateToLocation = (coordinates: [number, number], placeName: string) => {
    if (!map.current) return;

    map.current.flyTo({
      center: coordinates,
      zoom: 15,
      duration: 1500
    });

    setSearchQuery(placeName);
    setShowSearchResults(false);
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
              placeholder="Adresse oder Ort suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  const firstResult = searchResults[0];
                  navigateToLocation(firstResult.center, firstResult.place_name);
                }
              }}
              className="pl-10 w-64 bg-card/95 backdrop-blur-md border-border shadow-xl"
              style={{ zIndex: 11 }}
            />
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden" style={{ zIndex: 15 }}>
                {searchResults.slice(0, 5).map((result, index) => (
                  <div
                    key={index}
                    className="px-4 py-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                    onClick={() => navigateToLocation(result.center, result.place_name)}
                  >
                    <div className="text-sm font-medium text-foreground">{result.text}</div>
                    <div className="text-xs text-muted-foreground">{result.place_name}</div>
                  </div>
                ))}
              </div>
            )}
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