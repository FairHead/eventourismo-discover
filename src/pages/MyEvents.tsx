import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Clock, Users, Heart, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface Event {
  id: string;
  title: string;
  description: string;
  start_utc: string;
  end_utc: string;
  lat: number;
  lng: number;
  event_type: string;
  genres: string[];
  status: string;
  organizer_id: string;
}

const MyEventsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMyEvents();
    }
  }, [user]);

  const fetchMyEvents = async () => {
    try {
      setLoading(true);
      
      // Fetch created events
      const { data: created, error: createdError } = await supabase
        .from('events')
        .select('*')
        .eq('organizer_id', user?.id)
        .order('start_utc', { ascending: true });

      if (createdError) throw createdError;

      // Get favorited event IDs first
      const { data: favorites, error: favoritesError } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user?.id)
        .eq('target_type', 'event');

      if (favoritesError) throw favoritesError;

      // Then fetch the actual events
      let favoriteEvents: Event[] = [];
      if (favorites && favorites.length > 0) {
        const eventIds = favorites.map(f => f.target_id);
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .order('start_utc', { ascending: true });

        if (eventsError) throw eventsError;
        favoriteEvents = events || [];
      }

      setCreatedEvents(created || []);
      setAttendedEvents(favoriteEvents);
    } catch (error) {
      console.error('Error fetching my events:', error);
      toast({
        title: "Fehler beim Laden",
        description: "Events konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-success/10 text-success';
      case 'draft': return 'bg-warning/10 text-warning';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted/50 text-muted-foreground';
    }
  };

  const getEventStatusText = (status: string) => {
    switch (status) {
      case 'published': return 'Veröffentlicht';
      case 'draft': return 'Entwurf';
      case 'cancelled': return 'Abgesagt';
      default: return status;
    }
  };

  const EventCard: React.FC<{ event: Event; showStatus?: boolean }> = ({ event, showStatus = false }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/events/${event.id}`)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-lg">{event.title}</h3>
            {showStatus && (
              <Badge className={getEventStatusColor(event.status)}>
                {getEventStatusText(event.status)}
              </Badge>
            )}
          </div>
          
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(event.start_utc)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatTime(event.start_utc)}</span>
            </div>
          </div>
          
          {event.genres && event.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
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
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Meine Events</h1>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Meine Events</h1>
          </div>
          <Button onClick={() => navigate('/events/create')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Event erstellen
          </Button>
        </div>

        <Tabs defaultValue="created" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="created" className="text-sm">
              Meine Events ({createdEvents.length})
            </TabsTrigger>
            <TabsTrigger value="attended" className="text-sm">
              Besuchte Events ({attendedEvents.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="created" className="space-y-4 mt-6">
            {createdEvents.length > 0 ? (
              createdEvents.map((event) => (
                <EventCard key={event.id} event={event} showStatus={true} />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">Noch keine Events erstellt</h3>
                <p className="text-sm mb-6 max-w-md mx-auto">Erstellen Sie Ihr erstes Event und teilen Sie es mit der Community.</p>
                <Button onClick={() => navigate('/events/create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Erstes Event erstellen
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="attended" className="space-y-4 mt-6">
            {attendedEvents.length > 0 ? (
              attendedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">Keine besuchten Events</h3>
                <p className="text-sm mb-6 max-w-md mx-auto">Entdecken Sie Events und fügen Sie sie zu Ihren Favoriten hinzu.</p>
                <Button onClick={() => navigate('/search')}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Events entdecken
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyEventsPage;