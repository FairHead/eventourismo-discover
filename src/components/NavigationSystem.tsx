import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Navigation, 
  Play, 
  Square, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  MapPin, 
  Clock, 
  Route,
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
  RotateCw
} from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import { supabase } from '@/integrations/supabase/client';

interface NavigationStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    bearing_after: number;
    bearing_before: number;
    location: [number, number];
  };
  geometry: {
    coordinates: [number, number][];
  };
}

interface NavigationRoute {
  distance: number;
  duration: number;
  steps: NavigationStep[];
  geometry: {
    coordinates: [number, number][];
  };
}

interface NavigationSystemProps {
  map: mapboxgl.Map | null;
  userLocation: [number, number] | null;
  destinationName: string;
  destinationCoords: [number, number];
  onNavigationEnd: () => void;
}

const NavigationSystem: React.FC<NavigationSystemProps> = ({
  map,
  userLocation,
  destinationName,
  destinationCoords,
  onNavigationEnd
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState(-1);
  const routeSourceId = useRef('navigation-route');
  const positionWatchId = useRef<number | null>(null);

  // Snap coordinates to nearest road
  const snapToRoad = async (coords: [number, number], token: string): Promise<[number, number]> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/matching/v5/mapbox/driving/${coords[0]},${coords[1]}?access_token=${token}&geometries=geojson&radiuses=50`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.matchings && data.matchings.length > 0) {
          const matchedCoords = data.matchings[0].geometry.coordinates[0];
          return [matchedCoords[0], matchedCoords[1]];
        }
      }
    } catch (error) {
      console.warn('Could not snap to road, using original coordinates:', error);
    }
    return coords; // Fallback to original coordinates
  };

  // Get nearest road address using reverse geocoding
  const getNearestAddress = async (coords: [number, number], token: string): Promise<[number, number]> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords[0]},${coords[1]}.json?access_token=${token}&types=address,poi&limit=1`
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

  // Calculate route to destination
  const calculateRoute = async (fromCoords: [number, number], toCoords: [number, number]) => {
    if (!map) return;

    setIsCalculatingRoute(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error || !data?.token) throw new Error('Mapbox token not available');

      // Ensure we always start from user's current location
      const startCoords = userLocation || fromCoords;
      
      // Snap destination to nearest road/address for better routing
      const snappedDestination = await getNearestAddress(toCoords, data.token);
      
      console.log('Routing from:', startCoords, 'to snapped destination:', snappedDestination);

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${startCoords[0]},${startCoords[1]};${snappedDestination[0]},${snappedDestination[1]}?steps=true&geometries=geojson&access_token=${data.token}&language=de`
      );

      if (!response.ok) throw new Error('Route calculation failed');

      const routeData = await response.json();
      if (routeData.routes && routeData.routes.length > 0) {
        const navigationRoute: NavigationRoute = {
          distance: routeData.routes[0].distance,
          duration: routeData.routes[0].duration,
          steps: routeData.routes[0].legs[0].steps,
          geometry: routeData.routes[0].geometry
        };

        setRoute(navigationRoute);
        setRemainingDistance(navigationRoute.distance);
        setRemainingDuration(navigationRoute.duration);
        displayRouteOnMap(navigationRoute);
        return navigationRoute;
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
    setIsCalculatingRoute(false);
    return null;
  };

  // Display route on map
  const displayRouteOnMap = (navigationRoute: NavigationRoute) => {
    if (!map) return;

    // Remove existing route
    try {
      if (map.getLayer(routeSourceId.current)) {
        map.removeLayer(routeSourceId.current);
      }
      if (map.getLayer(routeSourceId.current + '-outline')) {
        map.removeLayer(routeSourceId.current + '-outline');
      }
      if (map.getSource(routeSourceId.current)) {
        map.removeSource(routeSourceId.current);
      }
    } catch (error) {
      console.warn('Error removing existing route:', error);
    }

    // Add new route
    map.addSource(routeSourceId.current, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: navigationRoute.geometry.coordinates
        }
      }
    });

    // Route outline (white border)
    map.addLayer({
      id: routeSourceId.current + '-outline',
      type: 'line',
      source: routeSourceId.current,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': 8,
        'line-opacity': 0.9
      }
    });

    // Main route line (blue)
    map.addLayer({
      id: routeSourceId.current,
      type: 'line',
      source: routeSourceId.current,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#007AFF',
        'line-width': 6,
        'line-opacity': 1
      }
    });

    // Fit map to route
    const coordinates = navigationRoute.geometry.coordinates;
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 100, left: 50, right: 50 }
    });
  };

  // Get icon for maneuver type
  const getManeuverIcon = (type: string, modifier?: string) => {
    const iconProps = { className: "w-6 h-6", strokeWidth: 2 };
    
    switch (type) {
      case 'depart':
        return <Play {...iconProps} />;
      case 'arrive':
        return <MapPin {...iconProps} />;
      case 'turn':
        if (modifier === 'right') return <ArrowRight {...iconProps} />;
        if (modifier === 'left') return <ArrowLeft {...iconProps} />;
        if (modifier === 'slight right') return <ArrowUpRight {...iconProps} />;
        if (modifier === 'slight left') return <ArrowUpLeft {...iconProps} />;
        if (modifier === 'sharp right') return <ArrowDownRight {...iconProps} />;
        if (modifier === 'sharp left') return <ArrowDownLeft {...iconProps} />;
        return <ArrowUp {...iconProps} />;
      case 'roundabout':
      case 'rotary':
        return <RotateCw {...iconProps} />;
      case 'continue':
      case 'merge':
        return <ArrowUp {...iconProps} />;
      default:
        return <ArrowUp {...iconProps} />;
    }
  };

  // Format distance
  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} Min`;
  };

  // Speak instruction using Web Speech API
  const speakInstruction = (instruction: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(instruction);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  };

  // Calculate distance between two points
  const calculateDistance = (point1: [number, number], point2: [number, number]) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1[1] * Math.PI / 180;
    const φ2 = point2[1] * Math.PI / 180;
    const Δφ = (point2[1] - point1[1]) * Math.PI / 180;
    const Δλ = (point2[0] - point1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Update navigation progress
  const updateNavigationProgress = (currentLocation: [number, number]) => {
    if (!route || !isNavigating) return;

    let currentStep = currentStepIndex;
    let distanceToNextManeuver = 0;
    let totalRemainingDistance = 0;
    let totalRemainingDuration = 0;

    // Find current step based on proximity to maneuver locations
    for (let i = currentStepIndex; i < route.steps.length; i++) {
      const step = route.steps[i];
      const maneuverLocation = step.maneuver.location;
      const distanceToManeuver = calculateDistance(currentLocation, maneuverLocation);

      if (distanceToManeuver < 50) { // Within 50 meters of maneuver
        currentStep = Math.min(i + 1, route.steps.length - 1);
        setCurrentStepIndex(currentStep);

        // Announce instruction for next step
        if (voiceEnabled && currentStep < route.steps.length && currentStep !== lastAnnouncedStep) {
          speakInstruction(route.steps[currentStep].instruction);
          setLastAnnouncedStep(currentStep);
        }
        break;
      }
    }

    // Calculate remaining distance and duration
    for (let i = currentStep; i < route.steps.length; i++) {
      totalRemainingDistance += route.steps[i].distance;
      totalRemainingDuration += route.steps[i].duration;
    }

    // Calculate distance to next maneuver
    if (currentStep < route.steps.length) {
      const nextManeuverLocation = route.steps[currentStep].maneuver.location;
      distanceToNextManeuver = calculateDistance(currentLocation, nextManeuverLocation);
    }

    setRemainingDistance(totalRemainingDistance);
    setRemainingDuration(totalRemainingDuration);

    // Check if arrived at destination (within 20 meters)
    const distanceToDestination = calculateDistance(currentLocation, destinationCoords);
    if (distanceToDestination < 20) {
      stopNavigation();
      if (voiceEnabled) {
        speakInstruction(`Sie haben Ihr Ziel ${destinationName} erreicht.`);
      }
    }
  };

  // Start navigation
  const startNavigation = async () => {
    if (!userLocation) return;

    const calculatedRoute = await calculateRoute(userLocation, destinationCoords);
    if (!calculatedRoute) return;

    setIsNavigating(true);
    setCurrentStepIndex(0);
    setLastAnnouncedStep(-1);

    // Start position tracking
    if (navigator.geolocation) {
      positionWatchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const currentLocation: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          updateNavigationProgress(currentLocation);
        },
        (error) => {
          console.warn('Navigation position error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
    }

    // Announce first instruction
    if (voiceEnabled && calculatedRoute.steps.length > 0) {
      setTimeout(() => {
        speakInstruction(calculatedRoute.steps[0].instruction);
        setLastAnnouncedStep(0);
      }, 1000);
    }
  };

  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    
    // Stop position tracking
    if (positionWatchId.current) {
      navigator.geolocation.clearWatch(positionWatchId.current);
      positionWatchId.current = null;
    }

    // Remove route from map
    if (map) {
      try {
        if (map.getLayer(routeSourceId.current)) {
          map.removeLayer(routeSourceId.current);
        }
        if (map.getLayer(routeSourceId.current + '-outline')) {
          map.removeLayer(routeSourceId.current + '-outline');
        }
        if (map.getSource(routeSourceId.current)) {
          map.removeSource(routeSourceId.current);
        }
      } catch (error) {
        console.warn('Error removing navigation route:', error);
      }
    }

    onNavigationEnd();
  };

  // Recalculate route
  const recalculateRoute = async () => {
    if (!userLocation || !isNavigating) return;
    await calculateRoute(userLocation, destinationCoords);
  };

  // Initialize route calculation
  useEffect(() => {
    if (userLocation) {
      calculateRoute(userLocation, destinationCoords);
    }
  }, [userLocation, destinationCoords]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (positionWatchId.current) {
        navigator.geolocation.clearWatch(positionWatchId.current);
      }
    };
  }, []);

  return (
    <div className="absolute top-4 left-4 right-4 z-20 space-y-2">
      {/* Navigation Header */}
      <Card className="bg-card/95 backdrop-blur-md border border-border shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-500" />
              <span className="font-medium">Navigation zu</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="p-1"
            >
              {voiceEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="text-lg font-semibold text-foreground mb-2">
            {destinationName}
          </div>

          {route && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Route className="w-4 h-4" />
                {formatDistance(remainingDistance)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(remainingDuration)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Instruction */}
      {route && route.steps.length > 0 && currentStepIndex < route.steps.length && (
        <Card className="bg-blue-500/95 backdrop-blur-md border border-blue-400 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="text-white">
                {getManeuverIcon(
                  route.steps[currentStepIndex].maneuver.type,
                  route.steps[currentStepIndex].maneuver.modifier
                )}
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">
                  {route.steps[currentStepIndex].instruction}
                </div>
                <div className="text-blue-100 text-sm">
                  {formatDistance(route.steps[currentStepIndex].distance)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Controls */}
      <Card className="bg-card/95 backdrop-blur-md border border-border shadow-xl">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {!isNavigating ? (
              <Button 
                onClick={startNavigation}
                disabled={isCalculatingRoute || !route}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                {isCalculatingRoute ? 'Route berechnen...' : 'Navigation starten'}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={stopNavigation}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Navigation beenden
                </Button>
                <Button
                  onClick={recalculateRoute}
                  variant="secondary"
                  size="icon"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NavigationSystem;