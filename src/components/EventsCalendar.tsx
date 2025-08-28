import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarDays, Bell, MapPin, Clock } from 'lucide-react';
import ReminderModal from './ReminderModal';

interface Event {
  id: string;
  title: string;
  start_utc: string;
  end_utc: string;
  event_type: string;
  venue_name?: string;
  band_name?: string;
  organizer_name?: string;
}

interface Reminder {
  id: string;
  event_id: string;
  reminder_time: string;
  message?: string;
  is_active: boolean;
}

const EventsCalendar: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [favoriteEvents, setFavoriteEvents] = useState<Event[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFavoriteEvents();
      fetchReminders();
    }
  }, [user]);

  const fetchFavoriteEvents = async () => {
    if (!user) return;

    try {
      // First get the favorite event IDs
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'event');

      if (favoriteError) throw favoriteError;

      const eventIds = favoriteData?.map(fav => fav.target_id) || [];
      
      if (eventIds.length === 0) {
        setFavoriteEvents([]);
        return;
      }

      // Then get the event details
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_utc,
          end_utc,
          event_type,
          venue_id,
          band_id,
          organizer_id,
          venues (name),
          bands (name),
          users (display_name)
        `)
        .in('id', eventIds)
        .order('start_utc', { ascending: true });

      if (eventsError) throw eventsError;

      const events = eventsData?.map(event => ({
        id: event.id,
        title: event.title,
        start_utc: event.start_utc,
        end_utc: event.end_utc,
        event_type: event.event_type,
        venue_name: event.venues?.name,
        band_name: event.bands?.name,
        organizer_name: event.users?.display_name,
      })) || [];

      setFavoriteEvents(events);
    } catch (error) {
      console.error('Error fetching favorite events:', error);
      toast({
        title: "Fehler",
        description: "Favoriten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReminders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  const getEventsForDate = (date: Date) => {
    return favoriteEvents.filter(event => 
      isSameDay(parseISO(event.start_utc), date)
    );
  };

  const getEventTypeColor = (eventType: string) => {
    const colors = {
      concert: 'bg-primary/20 text-primary',
      festival: 'bg-accent/20 text-accent',
      party: 'bg-secondary/20 text-secondary',
      exhibition: 'bg-muted-foreground/20 text-muted-foreground',
      theater: 'bg-destructive/20 text-destructive',
      other: 'bg-muted/20 text-muted-foreground'
    };
    return colors[eventType as keyof typeof colors] || colors.other;
  };

  const hasEventOnDate = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  const hasReminderForEvent = (eventId: string) => {
    return reminders.some(reminder => reminder.event_id === eventId);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowReminderModal(true);
  };

  const handleReminderSuccess = () => {
    fetchReminders();
    setShowReminderModal(false);
    setSelectedEvent(null);
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Event-Kalender
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Event-Kalender ({favoriteEvents.length} Favoriten)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className={`rounded-md border pointer-events-auto`}
            modifiers={{
              hasEvent: (date) => hasEventOnDate(date)
            }}
            modifiersStyles={{
              hasEvent: {
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 'bold'
              }
            }}
            locale={de}
          />

          {selectedDateEvents.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">
                Events am {format(selectedDate, 'dd. MMMM yyyy', { locale: de })}
              </h3>
              {selectedDateEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{event.title}</h4>
                          <Badge 
                            variant="secondary" 
                            className={getEventTypeColor(event.event_type)}
                          >
                            {event.event_type}
                          </Badge>
                          {hasReminderForEvent(event.id) && (
                            <Badge variant="outline" className="text-accent border-accent">
                              <Bell className="w-3 h-3 mr-1" />
                              Erinnerung
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(event.start_utc), 'HH:mm')}
                          </div>
                          {event.venue_name && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.venue_name}
                            </div>
                          )}
                        </div>

                        {(event.band_name || event.organizer_name) && (
                          <p className="text-sm text-muted-foreground">
                            von {event.band_name || event.organizer_name}
                          </p>
                        )}
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant={hasReminderForEvent(event.id) ? "secondary" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        <Bell className="w-4 h-4 mr-1" />
                        {hasReminderForEvent(event.id) ? 'Bearbeiten' : 'Erinnerung'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedDateEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Keine Events am {format(selectedDate, 'dd. MMMM', { locale: de })}</p>
              <p className="text-sm mt-1">Wähle ein anderes Datum oder füge Events zu deinen Favoriten hinzu.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => {
          setShowReminderModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        existingReminder={selectedEvent ? reminders.find(r => r.event_id === selectedEvent.id) : undefined}
        onSuccess={handleReminderSuccess}
      />
    </>
  );
};

export default EventsCalendar;