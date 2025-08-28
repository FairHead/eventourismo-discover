import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  MapPin, 
  Clock, 
  Heart, 
  ExternalLink,
  Calendar,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface ExternalEventsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  venueEvents: ExternalEvent[];
  venueName: string;
  venueAddress?: string;
}

const ExternalEventsPanel: React.FC<ExternalEventsPanelProps> = ({ 
  isOpen, 
  onClose, 
  venueEvents, 
  venueName, 
  venueAddress 
}) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [favoriteEvents, setFavoriteEvents] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const toggleFavorite = async (event: ExternalEvent) => {
    if (!user) {
      toast.error("Bitte melden Sie sich an, um Favoriten zu verwalten");
      return;
    }

    try {
      const isFavorite = favoriteEvents.has(event.id);
      
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('target_id', event.id)
          .eq('target_type', 'external_event');

        if (error) throw error;

        setFavoriteEvents(prev => {
          const newFavorites = new Set(prev);
          newFavorites.delete(event.id);
          return newFavorites;
        });

        toast.success("Event aus Favoriten entfernt");
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            target_id: event.id,
            target_type: 'external_event'
          });

        if (error) throw error;

        setFavoriteEvents(prev => new Set(prev).add(event.id));
        toast.success("Event zu Favoriten hinzugefügt");
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error("Fehler beim Verwalten der Favoriten");
    }
  };

  const getSourceBadge = (source: string) => {
    const sourceConfig = {
      ticketmaster: { label: 'Ticketmaster', className: 'bg-blue-500 text-white' },
      eventbrite: { label: 'Eventbrite', className: 'bg-orange-500 text-white' },
      meetup: { label: 'Meetup', className: 'bg-red-500 text-white' },
      'kulturdaten-berlin': { label: 'Kulturdaten Berlin', className: 'bg-purple-500 text-white' },
      'koeln-opendata': { label: 'Köln Open Data', className: 'bg-green-500 text-white' }
    };
    
    const config = sourceConfig[source as keyof typeof sourceConfig] || { label: source, className: 'bg-gray-500 text-white' };
    
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const getEventStatus = (startsAt: string, endsAt?: string) => {
    const now = new Date();
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    
    if (now < start) {
      const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilStart <= 3) {
        return { status: 'starting_soon', label: 'Beginnt bald' };
      }
      return { status: 'upcoming', label: 'Bevorstehend' };
    }
    
    if (end && now >= start && now <= end) {
      return { status: 'live', label: 'Läuft gerade' };
    }
    
    if (end && now > end) {
      return { status: 'finished', label: 'Beendet' };
    }
    
    return { status: 'upcoming', label: 'Event' };
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-full md:w-96 bg-card/95 backdrop-blur-md border-r border-border shadow-2xl z-50 transition-transform duration-300 ease-out overflow-y-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="sticky top-0 bg-card/98 backdrop-blur-md border-b border-border p-4 flex items-center justify-between z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{venueName}</h2>
            {venueAddress && (
              <p className="text-sm text-muted-foreground truncate">{venueAddress}</p>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="hover:bg-muted/50 flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              {venueEvents.length} Event{venueEvents.length !== 1 ? 's' : ''} gefunden
            </h3>
          </div>

          {venueEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);
            const isFavorite = favoriteEvents.has(event.id);
            const { date, time } = formatDateTime(event.starts_at);
            const endDateTime = event.ends_at ? formatDateTime(event.ends_at) : null;
            const { status, label } = getEventStatus(event.starts_at, event.ends_at);
            
            return (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getSourceBadge(event.source)}
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs",
                            status === 'starting_soon' && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                            status === 'live' && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                            status === 'finished' && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {label}
                        </Badge>
                      </div>
                      <CardTitle className="text-base leading-tight">{event.title}</CardTitle>
                      {event.category && (
                        <p className="text-sm text-muted-foreground mt-1">{event.category}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleFavorite(event)}
                      >
                        <Heart 
                          className={cn(
                            "w-4 h-4",
                            isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                          )} 
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleExpanded(event.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Event Image */}
                  {event.image_url && (
                    <div className="mt-3 rounded-md overflow-hidden aspect-video bg-muted">
                      <img 
                        src={event.image_url} 
                        alt={event.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Date & Time */}
                  <div className="flex items-center justify-between text-sm mt-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>{date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{time}</span>
                      {endDateTime && (
                        <span className="text-muted-foreground">- {endDateTime.time}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-3">
                    <Separator />
                    
                    {/* Description */}
                    {event.description && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Beschreibung</h4>
                        <p className="text-sm text-muted-foreground line-clamp-4">{event.description}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {event.ticket_url && (
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => window.open(event.ticket_url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Tickets
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {venueEvents.length === 0 && (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Keine Events an diesem Ort gefunden</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ExternalEventsPanel;