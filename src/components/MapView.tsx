import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, MapPin, Users, Navigation as NavigationIcon, X, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import NavigationSystem from './NavigationSystem';
import ExternalEventsPanel from './ExternalEventsPanel';

interface MapViewProps {
  onPinClick?: (eventId: string) => void;
  events?: EventData[];
  loading?: boolean;
  onMapReady?: (mapInstance: mapboxgl.Map) => void;
  selectedEventId?: string | null;
  onUserLocationChange?: (coords: [number, number]) => void;
  onFavoritesChange?: (favorites: Set<string>) => void;
  onToggleFavorite?: (eventId: string) => void;
}

interface ExternalEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  category?: string;
  description?: string;
  image_url?: string;
  ticket_url?: string;
  source: 'ticketmaster' | 'eventbrite' | 'meetup' | 'kulturdaten-berlin' | 'koeln-opendata';
  venue: {
    id?: string;
    name: string;
    address?: string;
    city?: string;
    lat: number;
    lng: number;
  };
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

const MapView: React.FC<MapViewProps> = ({ onPinClick, events = [], loading = false, onMapReady, selectedEventId, onUserLocationChange, onFavoritesChange, onToggleFavorite }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isMapboxReady, setIsMapboxReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [clusterMarkers, setClusterMarkers] = useState<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef<boolean>(false);
  const lastAccuracyRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<[number, number] | null>(null);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState<{
    name: string;
    coords: [number, number];
  } | null>(null);
  const [routeLayer, setRouteLayer] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeDestination, setRouteDestination] = useState<{
    name: string;
    coords: [number, number];
  } | null>(null);
  // External events state
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
  const externalEventMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [showExternalEventsPanel, setShowExternalEventsPanel] = useState(false);
  const [selectedVenueEvents, setSelectedVenueEvents] = useState<ExternalEvent[]>([]);
  const [selectedVenueName, setSelectedVenueName] = useState<string>('');
  const [selectedVenueAddress, setSelectedVenueAddress] = useState<string>('');
  const externalFetchReqIdRef = useRef(0);
  const lastExternalPinsKeyRef = useRef<string>('');
  const externalVenueMarkersMapRef = useRef<Record<string, { marker: mapboxgl.Marker; el: HTMLDivElement; venue: ExternalEvent['venue']; events: ExternalEvent[] }>>({});
  const nationwideLoadedRef = useRef<boolean>(false);
  const externalVenueDataRef = useRef<Record<string, { venue: ExternalEvent['venue']; events: ExternalEvent[] }>>({});
  const externalVenueLayerReadyRef = useRef<boolean>(false);

  // Fetch external events for current map bounds
  const fetchExternalEvents = async (bounds: mapboxgl.LngLatBounds) => {
    if (!map.current) return;

    // Ensure only the latest fetch renders markers
    const reqId = ++externalFetchReqIdRef.current;
    
    try {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      console.info('Fetching external events for bounds:', { sw, ne });

      const primary = await supabase.functions.invoke('fetch-external-events', {
        body: {
          bbox: {
            south: sw.lat,
            west: sw.lng,
            north: ne.lat,
            east: ne.lng
          },
          // Extend primary window to 30 days to increase hit rate
          date_from: new Date().toISOString(),
          date_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });

      if (primary.error) throw primary.error;

      let events: ExternalEvent[] = primary.data?.events ?? [];
      console.info('External events result (bounds-based):', events.length);

        // Fallback: If no events in current view, query all of Germany (max radius)
        if (events.length === 0) {
          // Germany approximate bounding box
          const deBBox = {
            south: 47.270111,
            west: 5.866342,
            north: 55.058347,
            east: 15.041896,
          };

          const fallbackBody = {
            bbox: deBBox,
            date_from: new Date().toISOString(),
            date_to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
          };

          console.info('No external events in view. Falling back to Germany bbox:', fallbackBody.bbox);
          const fallback = await supabase.functions.invoke('fetch-external-events', {
            body: fallbackBody,
          });
          if (!fallback.error && fallback.data?.events) {
            events = fallback.data.events as ExternalEvent[];
            console.info('External events result (Germany-fallback):', events.length);
          }
        }

      // If a newer request started, ignore this result
      if (reqId !== externalFetchReqIdRef.current) {
        console.info('Discarding stale external events response (reqId', reqId, 'current', externalFetchReqIdRef.current, ')');
        return;
      }

      setExternalEvents(events);
      updateExternalEventPins(events);
      
      // Debug logging for venues
      const venues = events.reduce((acc, event) => {
        const key = `${event.venue.name} (${event.venue.address}, ${event.venue.city})`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(event.title);
        return acc;
      }, {} as Record<string, string[]>);
      
      console.info('🎪 Found venues with events:', Object.entries(venues).map(([venue, eventTitles]) => 
        `${venue}: ${eventTitles.length} events (${eventTitles.join(', ')})`
      ).join('\n'));
    } catch (error) {
      console.error('Error fetching external events:', error);
    }
  };
  // Fetch user's favorites
  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'event');

      if (error) throw error;

      const newFavorites = new Set(data?.map(fav => fav.target_id) || []);
      setFavorites(newFavorites);
      
      // Notify parent component about favorites change
      if (onFavoritesChange) {
        onFavoritesChange(newFavorites);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  // Nationwide fetch (once) to preload Germany-wide venues
  const fetchExternalEventsNationwideOnce = async () => {
    if (!map.current || nationwideLoadedRef.current) return;
    nationwideLoadedRef.current = true;
    try {
      const deBBox = { south: 47.270111, west: 5.866342, north: 55.058347, east: 15.041896 };
      const resp = await supabase.functions.invoke('fetch-external-events', {
        body: {
          bbox: deBBox,
          date_from: new Date().toISOString(),
          date_to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      if (!resp.error && resp.data?.events) {
        const nationwide = resp.data.events as ExternalEvent[];
        setExternalEvents((prev) => {
          const merged = [...prev, ...nationwide];
          updateExternalEventPins(merged);
          return merged;
        });
        console.info('Preloaded nationwide external events:', nationwide.length);
      } else if (resp.error) {
        console.warn('Nationwide external events fetch error:', resp.error);
      }
    } catch (e) {
      console.warn('Nationwide external events fetch failed:', e);
    }
  };
  // Toggle favorite status
  const toggleFavorite = async (eventId: string) => {
    if (!user) {
      toast.error("Bitte melden Sie sich an, um Favoriten zu verwalten");
      return;
    }

    try {
      const isFavorite = favorites.has(eventId);
      
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('target_id', eventId)
          .eq('target_type', 'event');

        if (error) throw error;

        const newFavorites = new Set(favorites);
        newFavorites.delete(eventId);
        setFavorites(newFavorites);
        
        // Notify parent component
        if (onFavoritesChange) {
          onFavoritesChange(newFavorites);
        }
        
        toast.success("Event aus Favoriten entfernt");
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            target_id: eventId,
            target_type: 'event'
          });

        if (error) throw error;

        const newFavorites = new Set([...favorites, eventId]);
        setFavorites(newFavorites);
        
        // Notify parent component
        if (onFavoritesChange) {
          onFavoritesChange(newFavorites);
        }
        
        toast.success("Event zu Favoriten hinzugefügt");
      }
      
      // Notify parent about the toggle action
      if (onToggleFavorite) {
        onToggleFavorite(eventId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error("Fehler beim Verwalten der Favoriten");
    }
  };

  // Load favorites when user changes
  useEffect(() => {
    fetchFavorites();
  }, [user]);

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
      center: [11.0767, 49.4521], // Nürnberg default
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
      
      // Ensure map instance is valid before calling callback
      if (map.current && onMapReady) {
        onMapReady(map.current);
      }
      
      // Listen to zoom changes
      if (map.current) {
        map.current.on('zoom', () => {
          if (map.current) {
            const zoom = map.current.getZoom();
            setCurrentZoom(zoom);
            // Resize accuracy ring on zoom
            if (lastAccuracyRef.current && lastCoordsRef.current) {
              updateAccuracyRing(lastAccuracyRef.current, lastCoordsRef.current);
            }
          }
        });

        // Initial fetch once after map load
        if (map.current) {
          const initialBounds = map.current.getBounds();
          fetchExternalEvents(initialBounds);
          // Also preload Germany-wide venues once for stable markers across the country
          fetchExternalEventsNationwideOnce();
        }

        // Also fetch when map moves
        map.current.on('moveend', () => {
          if (map.current) {
            const bounds = map.current.getBounds();
            fetchExternalEvents(bounds);
          }
        });
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Get user location and track heading
  useEffect(() => {
    if (!navigator.geolocation || !map.current || !isMapboxReady) return;

    console.log('Setting up geolocation tracking...');

    // Center map on user's current position and create marker
    navigator.geolocation.getCurrentPosition(
(position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        console.log('Got initial user location:', coords);
        setUserLocation(coords);
        onUserLocationChange?.(coords);
        
        // Check if we came from Event Search with a specific event to focus on
        const hasPendingEventFocus = !!sessionStorage.getItem('focusEventId') && !!sessionStorage.getItem('focusEventData');
        const suppressAutoCenter = sessionStorage.getItem('suppressAutoCenter') === '1';
        
        if (!hasPendingEventFocus && !suppressAutoCenter) {
          console.log('Direct map access - zooming to user location:', coords);
          map.current?.flyTo({ center: coords, zoom: 14, duration: 2000 });
          hasCenteredRef.current = true;
        } else {
          console.log('Event search navigation or suppress flag detected - skipping user location zoom');
          hasCenteredRef.current = false;
        }
        
        // Always create user location marker
        console.log('Creating user location marker (initial)');
        createUserLocationMarker(coords);
        
        // Clear suppress flag after first geolocation handling
        if (suppressAutoCenter) {
          sessionStorage.removeItem('suppressAutoCenter');
        }
      },
      (error) => {
        console.warn('Geolocation error:', error.message, error.code);
        toast.error('Standort konnte nicht ermittelt werden. Bitte Standortzugriff erlauben.');
        // Try to get cached location or use default
        if (userLocation) {
          createUserLocationMarker(userLocation);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );

    // Start continuous position tracking
    if (geoWatchIdRef.current === null) {
      console.log('Starting geolocation watch...');
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
(position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          console.log('Location update:', coords, 'accuracy(m):', position.coords.accuracy);
          setUserLocation(coords);
          onUserLocationChange?.(coords);
          lastAccuracyRef.current = position.coords.accuracy ?? null;
          lastCoordsRef.current = coords;
          
          // Ensure marker exists and update position
          if (userMarkerRef.current && userMarkerRef.current.getElement()?.isConnected) {
            userMarkerRef.current.setLngLat(coords);
          } else {
            console.log('Marker missing or detached, recreating...');
            createUserLocationMarker(coords);
          }

          // Update accuracy ring size according to zoom and reported accuracy
          if (lastAccuracyRef.current) {
            updateAccuracyRing(lastAccuracyRef.current, coords);
          }

          // Center once on first accurate fix if not already centered
          if (!hasCenteredRef.current && map.current) {
            map.current.flyTo({ center: coords, zoom: Math.max(map.current.getZoom(), 14), duration: 1200 });
            hasCenteredRef.current = true;
          }
        },
        (error) => {
          console.warn('Geolocation watch error:', error.message, error.code);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
    }

    return () => {
      console.log('Cleaning up geolocation...');
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
    };
  }, [isMapboxReady]); // Keep dependency on isMapboxReady but add better logging

  // Track device orientation for heading
  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setUserHeading(event.alpha);
        
        // Update marker rotation
        if (userMarkerRef.current) {
          const element = userMarkerRef.current.getElement();
          const arrow = element.querySelector('.user-direction-arrow') as HTMLElement;
          if (arrow) {
            arrow.style.transform = `rotate(${event.alpha}deg)`;
          }
        }
      }
    };

    // Request permission for iOS devices
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleDeviceOrientation);
          }
        })
        .catch(console.error);
    } else {
      // For non-iOS devices
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, []);

  const createUserLocationMarker = (coords: [number, number]) => {
    // Ensure map is fully initialized and container exists
    if (!map.current || !isMapboxReady) {
      console.warn('Map not ready for marker creation');
      return;
    }
    
    try {
      const container = (map.current as any).getContainer?.();
      const canvas = (map.current as any).getCanvas?.();
      if (!container || !canvas) {
        console.warn('Map container/canvas not ready, skipping user marker creation');
        return;
      }

      // Remove existing user marker safely
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.remove();
          console.log('Removed existing user marker');
        } catch (e) {
          console.warn('Error removing existing marker:', e);
        }
        userMarkerRef.current = null;
      }

      console.log('Creating new user location marker at:', coords);

      // Create user location marker element
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.position = 'relative';
      el.style.zIndex = '1000';

      // User dot (inner circle)
      const userDot = document.createElement('div');
      userDot.style.width = '12px';
      userDot.style.height = '12px';
      userDot.style.backgroundColor = '#007AFF';
      userDot.style.borderRadius = '50%';
      userDot.style.border = '2px solid white';
      userDot.style.position = 'absolute';
      userDot.style.top = '50%';
      userDot.style.left = '50%';
      userDot.style.transform = 'translate(-50%, -50%)';
      userDot.style.boxShadow = '0 0 8px rgba(0, 122, 255, 0.6)';
      userDot.style.zIndex = '1002';

      // Accuracy circle (outer ring)
      const accuracyRing = document.createElement('div');
      accuracyRing.className = 'user-accuracy-ring';
      accuracyRing.style.width = '40px';
      accuracyRing.style.height = '40px';
      accuracyRing.style.border = '2px solid rgba(0, 122, 255, 0.3)';
      accuracyRing.style.borderRadius = '50%';
      accuracyRing.style.position = 'absolute';
      accuracyRing.style.top = '50%';
      accuracyRing.style.left = '50%';
      accuracyRing.style.transform = 'translate(-50%, -50%)';
      accuracyRing.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
      accuracyRing.style.zIndex = '1001';

      // Direction arrow
      const arrow = document.createElement('div');
      arrow.className = 'user-direction-arrow';
      arrow.style.width = '0';
      arrow.style.height = '0';
      arrow.style.borderLeft = '4px solid transparent';
      arrow.style.borderRight = '4px solid transparent';
      arrow.style.borderBottom = '12px solid #007AFF';
      arrow.style.position = 'absolute';
      arrow.style.top = '-6px';
      arrow.style.left = '50%';
      arrow.style.transform = 'translateX(-50%) rotate(0deg)';
      arrow.style.transformOrigin = '50% 18px';
      arrow.style.zIndex = '1003';
      arrow.style.transition = 'transform 0.3s ease';

      el.appendChild(accuracyRing);
      el.appendChild(userDot);
      el.appendChild(arrow);

      const marker = new mapboxgl.Marker({ 
        element: el, 
        anchor: 'center',
        pitchAlignment: 'auto',
        rotationAlignment: 'auto'
      })
        .setLngLat(coords)
        .addTo(map.current!);

      userMarkerRef.current = marker;
      console.log('Successfully created user location marker');
      
    } catch (err) {
      console.error('Failed to create user location marker:', err);
    }
  };

  // Convert meters to pixels at given latitude and zoom
  const metersToPixelsAtLat = (meters: number, latitude: number, zoom: number) => {
    const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
    return meters / metersPerPixel;
  };

  // Update the accuracy ring size according to map zoom and reported accuracy in meters
  const updateAccuracyRing = (accuracyMeters: number, coords: [number, number]) => {
    if (!map.current || !userMarkerRef.current) return;
    const zoom = map.current.getZoom();
    const px = metersToPixelsAtLat(Math.max(accuracyMeters, 5), coords[1], zoom);
    const size = Math.min(Math.max(px * 2, 20), 300); // keep sensible bounds
    const el = userMarkerRef.current.getElement();
    const ring = el.querySelector('.user-accuracy-ring') as HTMLElement | null;
    if (ring) {
      ring.style.width = `${size}px`;
      ring.style.height = `${size}px`;
    }
  };
  const getNearestAddress = async (coords: [number, number]): Promise<[number, number]> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords[0]},${coords[1]}.json?access_token=${mapboxToken}&types=address,poi&limit=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          return [feature.center[0], feature.center[1]];
        }
      }
    } catch (error) {
      console.warn('Could not get nearest address, using original coordinates:', error);
    }
    return coords; // Fallback to original coordinates
  };
  // Route calculation and display
  const calculateRoute = async (
    destination: [number, number],
    transportMode: 'walking' | 'cycling' | 'driving' | 'driving-traffic'
  ) => {
    if (!userLocation || !mapboxToken || !map.current) {
      console.warn('Missing requirements for route calculation');
      return;
    }

    try {
      // Snap destination to nearest road/address for better routing
      const snappedDestination = await getNearestAddress(destination);
      console.log('Original destination:', destination, 'Snapped to:', snappedDestination);

      const profile = transportMode === 'cycling' ? 'cycling' : 
                    transportMode === 'walking' ? 'walking' : 'driving';
      
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${userLocation[0]},${userLocation[1]};${snappedDestination[0]},${snappedDestination[1]}?` +
        `steps=true&geometries=geojson&access_token=${mapboxToken}&language=de`
      );

      if (!response.ok) throw new Error('Route calculation failed');

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        displayRoute(route);
        
        // Fit map to show entire route
        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        map.current.fitBounds(bounds, { padding: 50 });
        
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
    if (!map.current) return;

    // Remove existing route
    clearRoute();

    const routeId = 'route-' + Date.now();
    setRouteLayer(routeId);

    // Add route source
    map.current.addSource(routeId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });

    // Add route outline for better visibility (render first, so it's below)
    map.current.addLayer({
      id: routeId + '-outline',
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': 10,
        'line-opacity': 0.8
      }
    });

    // Add route layer (render on top of outline)
    map.current.addLayer({
      id: routeId,
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#007AFF',
        'line-width': 6,
        'line-opacity': 1.0
      }
    });

    // Ensure route is visible above everything but below UI
    // Don't move layers below event markers - keep route visible
  };

  const clearRoute = () => {
    if (!map.current) return;

    try {
      const style = map.current.getStyle();
      if (style?.layers) {
        // Remove ALL route-related layers
        style.layers.forEach(layer => {
          if (layer.id.includes('route') || layer.id.includes('navigation')) {
            try {
              map.current!.removeLayer(layer.id);
            } catch (e) {
              console.warn('Error removing layer:', layer.id, e);
            }
          }
        });
      }
      
      if (style?.sources) {
        // Remove ALL route-related sources
        Object.keys(style.sources).forEach(sourceId => {
          if (sourceId.includes('route') || sourceId.includes('navigation')) {
            try {
              map.current!.removeSource(sourceId);
            } catch (e) {
              console.warn('Error removing source:', sourceId, e);
            }
          }
        });
      }
    } catch (error) {
      console.warn('Error clearing route:', error);
    }
    
    setRouteLayer(null);
    setShowRoute(false);
    setRouteDestination(null);
  };

  // Display events on map when data changes or zoom changes
  useEffect(() => {
    if (isMapboxReady && events.length > 0) {
      console.log('Displaying events, zoom level:', currentZoom, 'events count:', events.length);
      if (currentZoom >= 12) {
        clearClusterMarkers();
        addEventPins();
      } else {
        clearMarkers();
        addCityClusters();
      }
    }
  }, [events, isMapboxReady, currentZoom]);

  // Auto-update event statuses every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render of pins to update their status based on current time
      if (isMapboxReady && events.length > 0) {
        if (currentZoom >= 12) {
          addEventPins();
        } else {
          addCityClusters();
        }
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [events, isMapboxReady, currentZoom]);

  // Helper function to determine event status
  const getEventStatus = (startUtc: string, endUtc: string): 'upcoming' | 'starting_soon' | 'live' | 'ending_soon' | 'finished' | 'past' => {
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
  };

  const clearMarkers = () => {
    console.log('Clearing', markers.length, 'event markers');
    markers.forEach(marker => {
      try {
        marker.remove();
      } catch (error) {
        console.warn('Error removing marker:', error);
      }
    });
    setMarkers([]);
  };

  const clearClusterMarkers = () => {
    console.log('Clearing', clusterMarkers.length, 'cluster markers');
    clusterMarkers.forEach(marker => {
      try {
        marker.remove();
      } catch (error) {
        console.warn('Error removing cluster marker:', error);
      }
    });
    setClusterMarkers([]);
  };

  // Update external event pins on map
  const updateExternalEventPins = (events: ExternalEvent[]) => {
    if (!map.current) return;

    // Remove legacy HTML markers once (switch to GeoJSON layer for stability)
    if (Object.keys(externalVenueMarkersMapRef.current).length > 0) {
      Object.values(externalVenueMarkersMapRef.current).forEach(({ marker }) => {
        try { marker.remove(); } catch {}
      });
      externalVenueMarkersMapRef.current = {};
    }

    // Prepare and group events by venue (with safe coordinates and stable keys)
    const safeEvents = events
      .map((e) => {
        const lat = Number((e.venue as any).lat);
        const lng = Number((e.venue as any).lng);
        return { ...e, venue: { ...e.venue, lat, lng } } as ExternalEvent;
      })
      .filter((e) =>
        Number.isFinite(e.venue.lat) &&
        Number.isFinite(e.venue.lng) &&
        Math.abs(e.venue.lat) <= 90 &&
        Math.abs(e.venue.lng) <= 180
      );

    const normalize = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, '-');

    const venueGroups = safeEvents.reduce((groups, event) => {
      const v = event.venue;
      const nameKey = normalize(v.name) || 'unknown';
      const cityKey = normalize(v.city) || 'unknown';
      let key = (v.id && v.id.trim().length > 0) ? v.id : `${nameKey}|${cityKey}`;
      if (key === 'unknown|unknown') {
        key = `${key}|${v.lat.toFixed(5)}_${v.lng.toFixed(5)}`;
      }
      if (!groups[key]) {
        groups[key] = {
          key,
          venue: v,
          events: [] as ExternalEvent[],
        };
      }
      groups[key].events.push(event);
      return groups;
    }, {} as Record<string, { key: string; venue: ExternalEvent['venue']; events: ExternalEvent[] }>);

    // Deduplicate events per venue by id
    Object.values(venueGroups).forEach((g) => {
      const seen = new Set<string>();
      g.events = g.events.filter((ev) => {
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      });
    });

    // Cache for click handling
    externalVenueDataRef.current = Object.fromEntries(
      Object.values(venueGroups).map((g) => [g.key, { venue: g.venue, events: g.events }])
    );

    // Build GeoJSON FeatureCollection
    const features = Object.values(venueGroups).map((g) => ({
      type: 'Feature' as const,
      properties: {
        key: g.key,
        name: g.venue.name,
        city: g.venue.city || '',
        address: g.venue.address || '',
        count: g.events.length,
        sourceTag: g.events.some((e) => e.source === 'ticketmaster') ? 'ticketmaster' : 'other',
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [g.venue.lng, g.venue.lat],
      },
    }));

    const fc = { type: 'FeatureCollection' as const, features };

    // Add or update source/layers
    const sourceId = 'external-venues';
    const circleLayerId = 'external-venues-circles';
    const labelLayerId = 'external-venues-labels';

    const existingSource = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(fc as any);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data: fc as any });

      // Circles for pins
      map.current.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'count'],
            1, 10,
            5, 13,
            10, 16,
            20, 20
          ],
          'circle-color': [
            'match', ['get', 'sourceTag'],
            'ticketmaster', '#1d4ed8',
            /* other */ '#059669'
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      });

      // Labels with counts
      map.current.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['to-string', ['get', 'count']],
          'text-size': 12,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 0.8,
        },
      });

      // Interactions (once)
      if (!externalVenueLayerReadyRef.current) {
        externalVenueLayerReadyRef.current = true;

        const openPanel = (f: any) => {
          const props = f.properties || {};
          const key = props.key as string;
          const data = externalVenueDataRef.current[key];
          if (data) {
            setSelectedVenueEvents(data.events);
            setSelectedVenueName(data.venue.name);
            setSelectedVenueAddress(`${data.venue.address || ''}, ${data.venue.city || ''}`.replace(/^,\s*/, ''));
            setShowExternalEventsPanel(true);
          }
        };

        map.current.on('mouseenter', circleLayerId, () => {
          map.current && (map.current.getCanvas().style.cursor = 'pointer');
        });
        map.current.on('mouseleave', circleLayerId, () => {
          map.current && (map.current.getCanvas().style.cursor = '');
        });
        map.current.on('click', circleLayerId, (e) => {
          if (!e.features || e.features.length === 0) return;
          openPanel(e.features[0]);
        });
        map.current.on('click', labelLayerId, (e) => {
          if (!e.features || e.features.length === 0) return;
          openPanel(e.features[0]);
        });
      }
    }

    // Update cache key (debug/consistency)
    const newPinsKey = Object.keys(venueGroups).sort().join('|') + `:${safeEvents.length}`;
    lastExternalPinsKeyRef.current = newPinsKey;
  };
  const addCityClusters = () => {
    if (!map.current) return;

    // Clear existing cluster markers
    clearClusterMarkers();
    const newClusterMarkers: mapboxgl.Marker[] = [];

    // Filter out past events
    const activeEvents = events.filter(event => {
      const status = getEventStatus(event.start_utc, event.end_utc);
      return status !== 'past';
    });

    // Group events by approximate location (0.1 degree grid ~ 11km)
    const clusters = new Map<string, EventData[]>();
    
    activeEvents.forEach(event => {
      const gridLat = Math.floor(event.lat * 10) / 10;
      const gridLng = Math.floor(event.lng * 10) / 10;
      const gridKey = `${gridLat},${gridLng}`;
      
      if (!clusters.has(gridKey)) {
        clusters.set(gridKey, []);
      }
      clusters.get(gridKey)!.push(event);
    });

    console.log('Creating', clusters.size, 'city clusters');

    clusters.forEach((clusterEvents, gridKey) => {
      const [gridLat, gridLng] = gridKey.split(',').map(Number);
      
      // Calculate cluster center (average position)
      const centerLat = clusterEvents.reduce((sum, e) => sum + e.lat, 0) / clusterEvents.length;
      const centerLng = clusterEvents.reduce((sum, e) => sum + e.lng, 0) / clusterEvents.length;
      
      // Count events by status
      const statusCounts = clusterEvents.reduce((counts, event) => {
        const status = getEventStatus(event.start_utc, event.end_utc);
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // Determine dominant status for cluster color
      const dominantStatus = Object.entries(statusCounts)
        .sort(([,a], [,b]) => b - a)[0][0];

      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.style.zIndex = '100';
      
      const cluster = document.createElement('div');
      cluster.style.width = '40px';
      cluster.style.height = '40px';
      cluster.style.borderRadius = '50%';
      cluster.style.display = 'flex';
      cluster.style.alignItems = 'center';
      cluster.style.justifyContent = 'center';
      cluster.style.fontSize = '14px';
      cluster.style.fontWeight = 'bold';
      cluster.style.color = 'white';
      cluster.style.backgroundColor = getClusterColor(dominantStatus);
      cluster.style.border = '3px solid white';
      cluster.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      cluster.style.transition = 'transform 0.2s ease';
      cluster.textContent = clusterEvents.length.toString();

      el.appendChild(cluster);

      // Hover effects
      el.addEventListener('mouseenter', () => {
        cluster.style.transform = 'scale(1.2)';
      });

      el.addEventListener('mouseleave', () => {
        cluster.style.transform = 'scale(1)';
      });

      // Click to zoom in to show individual events
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (map.current) {
          map.current.flyTo({
            center: [centerLng, centerLat],
            zoom: 14,
            duration: 1500
          });
        }
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([centerLng, centerLat])
        .addTo(map.current!);
      
      newClusterMarkers.push(marker);
    });

    setClusterMarkers(newClusterMarkers);
  };

  const getClusterColor = (dominantStatus: string): string => {
    const colors = {
      'upcoming': '#3b82f6',      // Blue
      'starting_soon': '#f97316', // Orange
      'live': '#22c55e',          // Green
      'ending_soon': '#eab308',   // Yellow
      'finished': '#ef4444',      // Red
    };
    return colors[dominantStatus as keyof typeof colors] || '#6b7280'; // Gray fallback
  };

  // Expose route calculation functions to parent (removed - using onMapReady callback instead)
  // React.useImperativeHandle(onMapReady as any, () => ({
  //   calculateRoute,
  //   clearRoute,
  //   getMap: () => map.current
  // }), [userLocation, mapboxToken]);
  const addEventPins = () => {
    if (!map.current) return;

    // Clear existing markers completely
    clearMarkers();
    const newMarkers: mapboxgl.Marker[] = [];

    // Filter out past events (older than 3 hours after end)
    const activeEvents = events.filter(event => {
      const status = getEventStatus(event.start_utc, event.end_utc);
      return status !== 'past';
    });

    console.log('Adding pins for events:', activeEvents.length, 'events');

    activeEvents.forEach((event) => {
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
      inner.style.backgroundColor = 'white';
      inner.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      inner.style.transition = 'transform 0.2s ease';
      inner.style.transformOrigin = 'center center';
      inner.style.willChange = 'transform';
      inner.textContent = '🎵';

      // Set border based on status
      if (status === 'upcoming') {
        inner.style.border = '2px solid #3b82f6'; // Blue border - bevorstehend
      } else if (status === 'starting_soon') {
        inner.style.border = '3px solid #f97316'; // Orange border - beginnt bald
        inner.style.animation = 'eventPulseOrange 2s infinite';
      } else if (status === 'live') {
        inner.style.border = '3px solid #22c55e'; // Green border - läuft gerade
        inner.style.animation = 'eventPulse 2s infinite';
      } else if (status === 'ending_soon') {
        inner.style.border = '3px solid #eab308'; // Yellow border - endet bald
        inner.style.animation = 'eventPulseYellow 2s infinite';
      } else if (status === 'finished') {
        inner.style.border = '3px solid #ef4444'; // Red border - beendet
        inner.style.animation = 'eventPulseRed 2s infinite';
      }

      el.appendChild(inner);

      // Hover effects
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

      // Click handler - show navigation context menu
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('Pin clicked for event:', event.id);
        
        // Show navigation context menu
        const contextMenu = document.createElement('div');
        contextMenu.style.cssText = `
          position: absolute;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 1000;
          min-width: 200px;
        `;
        const isFavorite = favorites.has(event.id);
        
        contextMenu.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 8px; color: #333;">${event.title}</div>
          <button id="favorite-btn" style="
            width: 100%;
            padding: 8px 12px;
            background: ${isFavorite ? '#ef4444' : '#f97316'};
            color: white;
            border: none;
            border-radius: 6px 6px 0 0;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            ${isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          </button>
          <button id="show-route-btn" style="
            width: 100%;
            padding: 8px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 0;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Route anzeigen
          </button>
          <button id="navigate-btn" style="
            width: 100%;
            padding: 8px 12px;
            background: #22c55e;
            color: white;
            border: none;
            border-radius: 0 0 6px 6px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="3,11 22,2 13,21 11,13 3,11"></polygon>
            </svg>
            Navigation starten
          </button>
          <button id="close-menu-btn" style="
            width: 100%;
            padding: 6px 12px;
            background: transparent;
            color: #666;
            border: none;
            cursor: pointer;
            font-size: 12px;
            margin-top: 4px;
          ">Abbrechen</button>
        `;
        
        // Handle favorite button click
        const favoriteBtn = contextMenu.querySelector('#favorite-btn');
        if (favoriteBtn) {
          favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleFavorite(event.id);
            contextMenu.remove();
          });
        }
        // Handle show route button click
        const showRouteBtn = contextMenu.querySelector('#show-route-btn');
        if (showRouteBtn) {
          showRouteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showRouteToEvent(event);
            contextMenu.remove();
          });
        }
        
        // Handle navigation button click
        const navigateBtn = contextMenu.querySelector('#navigate-btn');
        if (navigateBtn) {
          navigateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setNavigationDestination({
              name: event.title,
              coords: [event.lng, event.lat]
            });
            setIsNavigating(true);
            contextMenu.remove();
          });
        }
        
        // Handle close button click
        const closeBtn = contextMenu.querySelector('#close-menu-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            contextMenu.remove();
          });
        }
        // Close menu when clicking outside
        const closeOnClickOutside = (e: Event) => {
          if (!contextMenu.contains(e.target as Node)) {
            contextMenu.remove();
            document.removeEventListener('click', closeOnClickOutside);
          }
        };
        
        setTimeout(() => {
          document.addEventListener('click', closeOnClickOutside);
        }, 100);
        
        if (onPinClick) {
          onPinClick(event.id);
        }
      });

      // Create marker with center anchor
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        offset: [0, 0]
      })
        .setLngLat([event.lng, event.lat])
        .addTo(map.current!);
      
      newMarkers.push(marker);
    });

    console.log('Created', newMarkers.length, 'markers');
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

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

    // Offer navigation to searched location
    setNavigationDestination({
      name: placeName,
      coords: coordinates
    });
  };

  // Handle navigation end
  const handleNavigationEnd = () => {
    setIsNavigating(false);
    setNavigationDestination(null);
  };

  // Show simple route to event (not full navigation)
  const showRouteToEvent = async (event: EventData) => {
    if (!userLocation) {
      toast.error('Standort wird noch ermittelt...');
      return;
    }

    try {
      clearRoute(); // Clear any existing route
      setRouteDestination({
        name: event.title,
        coords: [event.lng, event.lat]
      });
      
      const routeInfo = await calculateRoute([event.lng, event.lat], 'walking');
      if (routeInfo) {
        setShowRoute(true);
        toast.success(`Route zu "${event.title}" wird angezeigt`);
      }
    } catch (error) {
      console.error('Route calculation failed:', error);
      toast.error('Route konnte nicht berechnet werden');
    }
  };

  return (
    <div className="relative w-full h-screen">
      {/* Add CSS for pulse animation */}
      <style>{`
        @keyframes eventPulse {
          0% {
            border-color: #22c55e;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 10px rgba(34, 197, 94, 0);
          }
          100% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
        
        @keyframes eventPulseOrange {
          0% {
            border-color: #f97316;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(249, 115, 22, 0.7);
          }
          70% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 10px rgba(249, 115, 22, 0);
          }
          100% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(249, 115, 22, 0);
          }
        }
        
        @keyframes eventPulseRed {
          0% {
            border-color: #ef4444;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 10px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        
        @keyframes eventPulseYellow {
          0% {
            border-color: #eab308;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(234, 179, 8, 0.7);
          }
          70% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 10px rgba(234, 179, 8, 0);
          }
          100% {
            box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 0 rgba(234, 179, 8, 0);
          }
        }
      `}</style>
      
      {/* Map Container - Lower Z-Index */}
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" style={{ zIndex: 1 }} />

      {/* UI Overlay - Higher Z-Index */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Route Controls - Show when route is active */}
        {showRoute && routeDestination && !isNavigating && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium">Route zu: {routeDestination.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setNavigationDestination(routeDestination);
                      setIsNavigating(true);
                    }}
                    size="sm"
                    variant="default"
                  >
                    <NavigationIcon className="w-4 h-4 mr-1" />
                    Navigation
                  </Button>
                  <Button
                    onClick={clearRoute}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search & Controls Bar - Only show when not navigating and no route */}
        {!isNavigating && !showRoute && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-2 pointer-events-auto">
            <div className="relative" ref={searchContainerRef}>
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
                      className="px-4 py-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0 flex items-center justify-between"
                      onClick={() => navigateToLocation(result.center, result.place_name)}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{result.text}</div>
                        <div className="text-xs text-muted-foreground">{result.place_name}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNavigationDestination({
                            name: result.place_name,
                            coords: result.center
                          });
                          setIsNavigating(true);
                          setShowSearchResults(false);
                        }}
                      >
                        <NavigationIcon className="w-4 h-4" />
                      </Button>
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
        )}

        {/* Navigation Start Button - Show when destination is selected but not navigating */}
        {navigationDestination && !isNavigating && (
          <div className="absolute top-4 left-4 right-4 pointer-events-auto">
            <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Navigation zu:</div>
                  <div className="text-lg font-semibold">{navigationDestination.name}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsNavigating(true)}
                    size="sm"
                  >
                    <NavigationIcon className="w-4 h-4 mr-2" />
                    Starten
                  </Button>
                  <Button
                    onClick={() => setNavigationDestination(null)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Stats Overlay - Only show when not navigating */}
      {!isNavigating && (
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl" style={{ zIndex: 11 }}>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                {currentZoom >= 12 
                  ? `${events.length} Events in der Nähe`
                  : `${events.length} Events • Zoom: ${currentZoom.toFixed(1)}`
                }
              </span>
            </div>
            {currentZoom < 12 && (
              <div className="text-xs text-muted-foreground mt-1">
                Zoom rein für Einzelevents
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Navigation System */}
      {isNavigating && navigationDestination && (
        <NavigationSystem
          map={map.current}
          userLocation={userLocation}
          destinationName={navigationDestination.name}
          destinationCoords={navigationDestination.coords}
          onNavigationEnd={handleNavigationEnd}
        />
      )}

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
      {/* External Events Panel */}
      {showExternalEventsPanel && (
        <ExternalEventsPanel
          isOpen={showExternalEventsPanel}
          onClose={() => setShowExternalEventsPanel(false)}
          venueEvents={selectedVenueEvents}
          venueName={selectedVenueName}
          venueAddress={selectedVenueAddress}
        />
      )}
    </div>
  );
};

export default MapView;