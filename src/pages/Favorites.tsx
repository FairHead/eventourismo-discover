import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MapPin, Calendar, Clock, Users, Star, Navigation, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface FavoriteEventData {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_utc: string;
  end_utc: string;
  lat: number;
  lng: number;
  genres: string[];
  bands?: {
    name: string;
    avatar_url?: string;
  };
  users?: {
    display_name?: string;
  };
  venues?: {
    name: string;
  };
}

const Favorites: React.FC = () => {
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchFavoriteEvents = async () => {
    if (!user) return;
    
    try {
      // Get favorite event IDs
      const { data: favorites, error: favError } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'event');

      if (favError) throw favError;

      if (!favorites || favorites.length === 0) {
        setFavoriteEvents([]);
        return;
      }

      const eventIds = favorites.map(fav => fav.target_id);

      // Get event details
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          users (display_name),
          bands (name, avatar_url),
          venues (name)
        `)
        .in('id', eventIds)
        .eq('status', 'published')
        .order('start_utc', { ascending: true });

      if (eventError) throw eventError;

      setFavoriteEvents(events || []);
    } catch (error) {
      console.error('Error fetching favorite events:', error);
      toast.error('Fehler beim Laden der Favoriten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavoriteEvents();
  }, [user]);

  const removeFavorite = async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('target_id', eventId)
        .eq('target_type', 'event');

      if (error) throw error;

      setFavoriteEvents(prev => prev.filter(event => event.id !== eventId));
      toast.success('Event aus Favoriten entfernt');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Fehler beim Entfernen des Favoriten');
    }
  };

  const navigateToEvent = (event: FavoriteEventData) => {
    sessionStorage.removeItem('focusEventId');
    sessionStorage.removeItem('focusEventData');
    sessionStorage.setItem('suppressAutoCenter', '1');
    
    sessionStorage.setItem('focusEventId', event.id);
    sessionStorage.setItem('focusEventData', JSON.stringify({
      lat: event.lat,
      lng: event.lng,
      zoom: 15
    }));
    
    navigate('/');
  };

  const getEventStatus = (startUtc: string, endUtc: string) => {
    const now = new Date();
    const start = new Date(startUtc);
    const end = new Date(endUtc);

    if (now < start) {
      const minutesToStart = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
      if (minutesToStart <= 180) return { status: 'starting_soon', text: 'Beginnt bald' };
      return { status: 'upcoming', text: 'Bevorstehend' };
    }
    
    if (now >= start && now <= end) {
      const minutesToEnd = Math.floor((end.getTime() - now.getTime()) / (1000 * 60));
      if (minutesToEnd <= 5) return { status: 'ending_soon', text: 'Endet bald' };
      return { status: 'live', text: 'Live' };
    }
    
    return { status: 'finished', text: 'Beendet' };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Favoriten werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold gradient-text">Meine Favoriten</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {favoriteEvents.length} {favoriteEvents.length === 1 ? 'Event' : 'Events'} gespeichert
          </p>
        </div>
      </div>

      {/* Favorites List */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {favoriteEvents.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Favoriten</h3>
            <p className="text-muted-foreground mb-6">
              Speichere Events als Favoriten, um sie hier wiederzufinden
            </p>
            <Button onClick={() => navigate('/search')} className="gap-2">
              <Navigation className="h-4 w-4" />
              Events entdecken
            </Button>
          </div>
        ) : (
          favoriteEvents.map((event) => {
            const eventStatus = getEventStatus(event.start_utc, event.end_utc);
            
            return (
              <Card key={event.id} className="overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group">
                <CardContent className="p-0">
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getStatusColor(eventStatus.status)}>
                            {eventStatus.text}
                          </Badge>
                          <Badge variant="outline">
                            {event.event_type}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavorite(event.id);
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Band/Organizer */}
                    {(event.bands || event.users) && (
                      <div className="flex items-center gap-3 mb-3">
                        {event.bands?.avatar_url && (
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={event.bands.avatar_url} />
                            <AvatarFallback>
                              <Users className="w-4 h-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {event.bands?.name || event.users?.display_name}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Time and Location */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(event.start_utc), 'dd.MM.yyyy', { locale: de })}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(event.start_utc), 'HH:mm', { locale: de })} - {format(new Date(event.end_utc), 'HH:mm', { locale: de })}
                        </span>
                      </div>
                      
                      {event.venues?.name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{event.venues.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Genres */}
                    {event.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
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

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateToEvent(event)}
                        className="gap-2"
                      >
                        <MapPin className="h-4 w-4" />
                        Auf Karte zeigen
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

export default Favorites;