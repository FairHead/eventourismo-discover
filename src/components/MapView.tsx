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
  onMapReady?: (mapInstance: mapboxgl.Map) => void;
  selectedEventId?: string | null;
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

const MapView: React.FC<MapViewProps> = ({ onPinClick, events = [], loading = false, onMapReady, selectedEventId }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isMapboxReady, setIsMapboxReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [userHeading, setUserHeading] = useState<number>(0);
  const [routeLayer, setRouteLayer] = useState<string | null>(null);
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
    if (!navigator.geolocation || !map.current) return;

    // Center map on user's current position (no marker creation here)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        setUserLocation(coords);
        
        // Check if we came from Event Search with a specific event to focus on
        const hasPendingEventFocus = !!sessionStorage.getItem('focusEventId') && !!sessionStorage.getItem('focusEventData');
        const suppressAutoCenter = sessionStorage.getItem('suppressAutoCenter') === '1';
        
        // Only zoom to user location if we didn't come from Event Search or suppress flag
        if (!hasPendingEventFocus && !suppressAutoCenter) {
          console.log('Direct map access - zooming to user location:', coords);
          map.current?.flyTo({ center: coords, zoom: 14, duration: 2000 });
        } else {
          console.log('Event search navigation or suppress flag detected - skipping user location zoom');
        }
        
        // Ensure marker exists immediately
        if (!userMarkerRef.current) {
          console.log('Creating user location marker (initial)');
          createUserLocationMarker(coords);
        }
        
        // Clear suppress flag after first geolocation handling
        if (suppressAutoCenter) {
          sessionStorage.removeItem('suppressAutoCenter');
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
      }
    );

    // Start watcher once
    if (geoWatchIdRef.current === null) {
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(coords);
          
          // Update existing marker position instead of creating new one
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat(coords);
          } else if (map.current) {
            // Create marker if it doesn't exist
            createUserLocationMarker(coords);
          }
        },
        (error) => {
          console.warn('Geolocation watch error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
    }

    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [isMapboxReady]); // Change dependency to isMapboxReady

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
    if (!map.current) return;
    try {
      const container = (map.current as any).getContainer?.();
      const canvas = (map.current as any).getCanvas?.();
      if (!container || !canvas) {
        console.warn('Map container/canvas not ready, skipping user marker creation');
        return;
      }

      // Remove existing user marker
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }

      // Create user location marker element
      const el = document.createElement('div');
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

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(map.current!);

      userMarkerRef.current = marker;
    } catch (err) {
      console.error('Failed to create user location marker:', err);
    }
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
      const profile = transportMode === 'cycling' ? 'cycling' : 
                    transportMode === 'walking' ? 'walking' : 'driving';
      
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${userLocation[0]},${userLocation[1]};${destination[0]},${destination[1]}?` +
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

    // Add route layer
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
        'line-opacity': 0.8
      }
    });

    // Add route outline for better visibility
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
        'line-width': 8,
        'line-opacity': 0.6
      }
    });

    // Move route layers below event markers
    map.current.moveLayer(routeId + '-outline');
    map.current.moveLayer(routeId);
  };

  const clearRoute = () => {
    if (!map.current || !routeLayer) return;

    try {
      // Remove route layers and source
      if (map.current.getLayer(routeLayer)) {
        map.current.removeLayer(routeLayer);
      }
      if (map.current.getLayer(routeLayer + '-outline')) {
        map.current.removeLayer(routeLayer + '-outline');
      }
      if (map.current.getSource(routeLayer)) {
        map.current.removeSource(routeLayer);
      }
    } catch (error) {
      console.warn('Error clearing route:', error);
    }
    
    setRouteLayer(null);
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

      // Click handler - ensure event ID is correctly passed
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('Pin clicked for event:', event.id);
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
        {/* Search & Controls Bar - Centered */}
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