import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search as SearchIcon, Heart, MapPin, Calendar, Clock, Users, Star } from 'lucide-react';
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
}

const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<EventData[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
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

      setEvents(data || []);
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

  useEffect(() => {
    fetchEvents();
    fetchFavorites();
  }, [user]);

  // Search filtering logic
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;

    const query = searchQuery.toLowerCase();
    return events.filter(event => {
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
  }, [events, searchQuery]);

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

  const navigateToEvent = (event: EventData) => {
    // Store the selected event in sessionStorage so MapPage can focus on it
    sessionStorage.setItem('focusEventId', event.id);
    sessionStorage.setItem('focusEventData', JSON.stringify({
      lat: event.lat,
      lng: event.lng,
      zoom: 15
    }));
    
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
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Stadt, Event-Name oder Location suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'} gefunden
            </p>
          )}
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
              <Card key={event.id} className="overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="flex">
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
                              {event.venues.name}
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
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFavorite(event.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Heart 
                              className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
                            />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateToEvent(event)}
                            className="h-8 w-8 p-0"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Click area to navigate to map */}
                  <div 
                    className="absolute inset-0 cursor-pointer z-0"
                    onClick={() => navigateToEvent(event)}
                  />
                  
                  {/* Buttons need higher z-index */}
                  <div className="absolute top-4 right-4 z-10">
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(event.id);
                        }}
                        className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                      >
                        <Heart 
                          className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
                        />
                      </Button>
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