import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Calendar, MapPin, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface FavoriteEventSummary {
  id: string;
  title: string;
  start_utc: string;
  event_type: string;
  bands?: { name: string };
  venues?: { name: string };
}

const FavoritesDashboard: React.FC = () => {
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchRecentFavorites = async () => {
    if (!user) return;
    
    try {
      // Get favorite event IDs
      const { data: favorites, error: favError } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'event')
        .order('created_at', { ascending: false })
        .limit(4); // Show only recent 4 favorites

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
          id, title, start_utc, event_type,
          bands (name),
          venues (name)
        `)
        .in('id', eventIds)
        .eq('status', 'published')
        .gte('end_utc', new Date().toISOString())
        .order('start_utc', { ascending: true });

      if (eventError) throw eventError;

      setFavoriteEvents(events || []);
    } catch (error) {
      console.error('Error fetching favorite events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentFavorites();
  }, [user]);

  const getEventStatus = (startUtc: string) => {
    const now = new Date();
    const start = new Date(startUtc);
    const minutesToStart = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
    
    if (minutesToStart <= 180 && minutesToStart > 0) {
      return { color: 'bg-upcoming text-upcoming-foreground', text: 'Beginnt bald' };
    }
    
    if (minutesToStart <= 1440 && minutesToStart > 180) { // Within 24 hours
      return { color: 'bg-accent text-accent-foreground', text: 'Heute' };
    }
    
    return { color: 'bg-secondary text-secondary-foreground', text: 'Bevorstehend' };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Meine Favoriten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg animate-pulse">
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="h-6 w-16 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Meine Favoriten
        </CardTitle>
      </CardHeader>
      <CardContent>
        {favoriteEvents.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Noch keine Events favorisiert
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/search')} className="gap-2">
              <Plus className="h-4 w-4" />
              Events entdecken
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {favoriteEvents.map((event) => {
              const eventStatus = getEventStatus(event.start_utc);
              
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 rounded-lg cursor-pointer transition-colors group"
                  onClick={() => navigate('/favorites')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${eventStatus.color} text-xs`}>
                        {eventStatus.text}
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {event.title}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(event.start_utc), 'dd.MM', { locale: de })}
                      </div>
                      {event.venues?.name && (
                        <div className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.venues.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              );
            })}
            
            {favoriteEvents.length >= 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/favorites')}
                className="w-full gap-2 mt-2"
              >
                Alle Favoriten anzeigen
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FavoritesDashboard;