import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search as SearchIcon, Heart, MapPin, Calendar, Clock, Users, Star, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
  // Add geocoded location info
  locationInfo?: {
    address: string;
    city: string;
    region: string;
  };
}

interface LocationSuggestion {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
}

const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<EventData[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [isLocationSearch, setIsLocationSearch] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

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

      console.log('Events loaded successfully:', data?.length || 0);
      setEvents(data || []);

      // Optionally try to add location info in background (non-blocking)
      if (data && data.length > 0) {
        setTimeout(async () => {
          try {
            const eventsWithLocation = await Promise.all(
              data.map(async (event) => {
                try {
                  const { data: locationData, error: geoError } = await supabase.functions.invoke(
                    'reverse-geocode',
                    {
                      body: { lat: event.lat, lng: event.lng }
                    }
                  );

                  if (!geoError && locationData) {
                    return {
                      ...event,
                      locationInfo: locationData
                    };
                  }
                } catch (error) {
                  console.warn('Geocoding failed for event:', event.id, error);
                }
                
                return event;
              })
            );

            console.log('Updated events with location info');
            setEvents(eventsWithLocation);
          } catch (error) {
            console.warn('Background geocoding failed:', error);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error("Events konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'event');

      if (error) throw error;

      setFavorites(new Set(data?.map(fav => fav.target_id) || []));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  // Debounced location search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length > 2 && !isLocationSearch) {
        searchLocations(searchQuery);
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isLocationSearch]);

  useEffect(() => {
    fetchEvents();
    fetchFavorites();
  }, [user]);

  const searchLocations = async (query: string) => {
    try {
      const { data: tokenData, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `country=DE&types=place,locality,neighborhood,address&language=de&limit=5&access_token=${tokenData.token}`
      );

      if (!response.ok) throw new Error('Geocoding failed');

      const data = await response.json();
      
      const suggestions: LocationSuggestion[] = data.features?.map((feature: any) => ({
        id: feature.id,
        text: feature.text,
        place_name: feature.place_name,
        center: feature.center,
        place_type: feature.place_type
      })) || [];

      setLocationSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Error searching locations:', error);
    }
  };

  // Calculate distance between two coordinates in km
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Search filtering logic
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // If location search is active, filter by proximity
    if (isLocationSearch && selectedLocation) {
      const maxDistance = 50; // 50km radius
      filtered = events.filter(event => {
        const distance = calculateDistance(
          selectedLocation.center[1], selectedLocation.center[0],
          event.lat, event.lng
        );
        return distance <= maxDistance;
      });
    }

    // Text search
    if (searchQuery.trim() && !isLocationSearch) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => {
        // Search by event title
        if (event.title.toLowerCase().includes(query)) return true;
        
        // Search by band name
        if (event.bands?.name.toLowerCase().includes(query)) return true;
        
        // Search by venue name
        if (event.venues?.name.toLowerCase().includes(query)) return true;
        
        // Search by organizer name
        if (event.users?.display_name?.toLowerCase().includes(query)) return true;
        if (event.users?.username?.toLowerCase().includes(query)) return true;
        
        // Search by description
        if (event.description?.toLowerCase().includes(query)) return true;
        
        // Search by genres
        if (event.genres.some(genre => genre.toLowerCase().includes(query))) return true;
        
        return false;
      });
    }

    return filtered;
  }, [events, searchQuery, isLocationSearch, selectedLocation]);

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

        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
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

        setFavorites(prev => new Set([...prev, eventId]));
        toast.success("Event zu Favoriten hinzugefügt");
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error("Fehler beim Verwalten der Favoriten");
    }
  };

  const handleLocationSelect = (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setSearchQuery(location.text);
    setIsLocationSearch(true);
    setShowSuggestions(false);
  };

  const clearLocationSearch = () => {
    setSelectedLocation(null);
    setIsLocationSearch(false);
    setSearchQuery('');
  };

  const navigateToEvent = (event: EventData) => {
    console.log('Navigating to event:', event.id, 'at location:', event.lat, event.lng);
    
    // Clear any existing session data first
    sessionStorage.removeItem('focusEventId');
    sessionStorage.removeItem('focusEventData');
    
    // Set suppress flag so the map won't auto-center to user on initial load
    sessionStorage.setItem('suppressAutoCenter', '1');
    
    // Store the selected event in sessionStorage so MapPage can focus on it
    sessionStorage.setItem('focusEventId', event.id);
    sessionStorage.setItem('focusEventData', JSON.stringify({
      lat: event.lat,
      lng: event.lng,
      zoom: 15
    }));
    
    console.log('Session data set:', {
      focusEventId: event.id,
      focusEventData: { lat: event.lat, lng: event.lng, zoom: 15 },
      suppressAutoCenter: true,
    });
    
    navigate('/');
  };

  const getEventStatus = (startUtc: string, endUtc: string): 'upcoming' | 'starting_soon' | 'live' | 'ending_soon' | 'finished' | 'past' => {
    const now = new Date();
    const start = new Date(startUtc);
    const end = new Date(endUtc);

    const minutesToStart = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
    const minutesToEnd = Math.floor((end.getTime() - now.getTime()) / (1000 * 60));
    const minutesSinceEnd = Math.floor((now.getTime() - end.getTime()) / (1000 * 60));

    if (now < start) {
      if (minutesToStart <= 180) return 'starting_soon';
      return 'upcoming';
    }
    
    if (now >= start && now <= end) {
      if (minutesToEnd <= 5) return 'ending_soon';
      return 'live';
    }
    
    if (now > end) {
      if (minutesSinceEnd <= 180) return 'finished';
      return 'past';
    }
    
    return 'upcoming';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-live text-live-foreground';
      case 'starting_soon': return 'bg-upcoming text-upcoming-foreground';
      case 'ending_soon': return 'bg-accent text-accent-foreground';
      case 'finished': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'Live';
      case 'starting_soon': return 'Beginnt bald';
      case 'ending_soon': return 'Endet bald';
      case 'finished': return 'Beendet';
      case 'upcoming': return 'Bevorstehend';
      default: return 'Event';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Events werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold gradient-text mb-4">Event Suche</h1>
          
          <div className="relative">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
              <Input
                type="text"
                placeholder="Stadt, Event-Name oder Location suchen..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (isLocationSearch && e.target.value !== selectedLocation?.text) {
                    setIsLocationSearch(false);
                    setSelectedLocation(null);
                  }
                }}
                className="pl-10 pr-10 h-12 text-base"
                onFocus={() => setShowSuggestions(locationSuggestions.length > 0)}
              />
              
              {isLocationSearch && selectedLocation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLocationSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <span className="text-lg">×</span>
                </Button>
              )}
            </div>

            {/* Location Suggestions Dropdown */}
            {showSuggestions && locationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <div className="text-xs text-muted-foreground mb-2 px-2">Orte</div>
                  {locationSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleLocationSelect(suggestion)}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 text-sm transition-colors"
                    >
                      <Navigation className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{suggestion.text}</div>
                        <div className="text-xs text-muted-foreground">{suggestion.place_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search Results Info */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground">
                  {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'} gefunden
                  {isLocationSearch && selectedLocation && (
                    <span> in der Nähe von {selectedLocation.text}</span>
                  )}
                </p>
              )}
            </div>
            
            {isLocationSearch && selectedLocation && (
              <Badge variant="secondary" className="text-xs">
                <Navigation className="h-3 w-3 mr-1" />
                Ortssuche
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'Keine Events gefunden' : 'Keine Events verfügbar'}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'Versuchen Sie es mit anderen Suchbegriffen'
                : 'Es gibt derzeit keine veröffentlichten Events'}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const status = getEventStatus(event.start_utc, event.end_utc);
            const isFavorite = favorites.has(event.id);
            
            return (
              <Card key={event.id} className="overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group cursor-pointer">
                <CardContent className="p-0 relative">
                  <div 
                    className="flex hover:bg-accent/50 transition-colors duration-200"
                    onClick={() => navigateToEvent(event)}
                  >
                    {/* Event Avatar/Image */}
                    <div className="flex-shrink-0 w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      {event.bands?.avatar_url ? (
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={event.bands.avatar_url} alt={event.bands.name} />
                          <AvatarFallback>{event.bands.name?.charAt(0) || 'E'}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-8 w-8 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs px-2 py-1 ${getStatusColor(status)}`}>
                              {getStatusText(status)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {event.event_type}
                            </Badge>
                          </div>
                          
                          <h3 className="font-semibold text-base mb-1 truncate">
                            {event.title}
                          </h3>
                          
                          {event.bands?.name && (
                            <p className="text-sm text-muted-foreground mb-2">
                              von {event.bands.name}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(event.start_utc), 'dd.MM.yyyy', { locale: de })}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.start_utc), 'HH:mm', { locale: de })}
                            </div>
                          </div>

                          {event.venues?.name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{event.venues.name}</span>
                            </div>
                          )}

                          {/* City and Location Info */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <Navigation className="h-3 w-3" />
                            <span className="truncate">
                              {isLocationSearch && selectedLocation ? (
                                `${Math.round(calculateDistance(selectedLocation.center[1], selectedLocation.center[0], event.lat, event.lng))} km entfernt`
                              ) : event.locationInfo?.city ? (
                                event.locationInfo.city
                              ) : (
                                `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`
                              )}
                            </span>
                          </div>

                          {/* Full Address (if available) */}
                          {event.locationInfo?.address && !isLocationSearch && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate text-xs">{event.locationInfo.address}</span>
                            </div>
                          )}

                          {event.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {event.genres.slice(0, 3).map((genre) => (
                                <Badge key={genre} variant="secondary" className="text-xs">
                                  {genre}
                                </Badge>
                              ))}
                              {event.genres.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{event.genres.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 relative z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(event.id);
                            }}
                            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-accent"
                          >
                            <Heart 
                              className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Search;