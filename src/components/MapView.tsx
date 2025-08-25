import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, MapPin, Users } from 'lucide-react';

interface EventPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
  type: 'event' | 'venue';
  status: 'live' | 'upcoming' | 'past';
  genre: string;
}

interface MapViewProps {
  onPinClick?: (eventId: string) => void;
}

const MapView: React.FC<MapViewProps> = ({ onPinClick }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapboxReady, setIsMapboxReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Demo event pins - replace with actual data
  const demoEvents: EventPin[] = [
    { id: '1', title: 'Jazz Night', lat: 52.520008, lng: 13.404954, type: 'event', status: 'live', genre: 'Jazz' },
    { id: '2', title: 'Rock Concert', lat: 52.518623, lng: 13.376200, type: 'event', status: 'upcoming', genre: 'Rock' },
    { id: '3', title: 'Electronic Beats', lat: 52.516272, lng: 13.377722, type: 'venue', status: 'upcoming', genre: 'Electronic' },
  ];

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Set up Mapbox token (user needs to add this)
    const mapboxToken = localStorage.getItem('mapbox-token');
    if (!mapboxToken) {
      console.warn('Mapbox token required. Please add your token in settings.');
      return;
    }

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
      addEventPins();
    });

    return () => {
      map.current?.remove();
    };
  }, []);

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

  const addEventPins = () => {
    if (!map.current) return;

    demoEvents.forEach((event) => {
      const el = document.createElement('div');
      el.className = `event-marker ${event.status} ${event.type}`;
      el.innerHTML = `
        <div class="marker-inner ${event.status === 'live' ? 'animate-pulse' : ''}">
          ${event.type === 'event' ? '🎵' : '🏛️'}
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
        background: ${event.status === 'live' ? 'hsl(var(--live))' : 'hsl(var(--primary))'}; 
        border: 2px solid hsl(var(--background));
        box-shadow: var(--shadow-glow);
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

      new mapboxgl.Marker(el)
        .setLngLat([event.lng, event.lat])
        .addTo(map.current!);
    });
  };

  return (
    <div className="relative w-full h-screen">
      {/* Search & Filter Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Nach Events, Künstlern, Venues suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/80 backdrop-blur-sm border-border"
          />
        </div>
        <Button variant="map" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Location Button */}
      <div className="absolute top-20 right-4 z-10">
        <Button
          variant="map"
          size="icon"
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
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 shadow-card">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{demoEvents.length} Events in der Nähe</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />

      {/* Mapbox Token Warning */}
      {!localStorage.getItem('mapbox-token') && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="bg-card p-6 rounded-lg border border-border shadow-card max-w-md text-center">
            <h3 className="text-lg font-semibold mb-2">Mapbox Token erforderlich</h3>
            <p className="text-muted-foreground mb-4">
              Für die Kartenansicht benötigen Sie einen Mapbox API Token.
            </p>
            <Button 
              variant="gradient"
              onClick={() => {
                const token = prompt('Mapbox Token eingeben:');
                if (token) {
                  localStorage.setItem('mapbox-token', token);
                  window.location.reload();
                }
              }}
            >
              Token hinzufügen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;