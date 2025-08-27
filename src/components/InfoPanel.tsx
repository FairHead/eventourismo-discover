import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  MapPin, 
  Clock, 
  Heart, 
  Share2, 
  ExternalLink,
  Calendar,
  Star,
  Users,
  Edit,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface EventData {
  id: string;
  title: string;
  subtitle: string;
  type: 'event' | 'venue';
  status: 'upcoming' | 'starting_soon' | 'live' | 'ending_soon' | 'finished' | 'past';
  startTime: string;
  endTime?: string;
  location: string;
  genres: string[];
  description: string;
  images: string[];
  ticketUrl?: string;
  websiteUrl?: string;
  rating?: number;
  attendees?: number;
  isFavorite?: boolean;
  organizerId?: string;
}

interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  eventData?: EventData;
  onEdit?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ isOpen, onClose, eventData, onEdit, onDelete }) => {
  if (!eventData) return null;

  const { user } = useAuth();
  const isEventCreator = user && eventData.organizerId === user.id;

  const getStatusBadge = (status: string) => {
    const variants = {
      upcoming: 'bg-blue-500 text-white',
      starting_soon: 'bg-orange-500 text-white',
      live: 'bg-green-500 text-white',
      ending_soon: 'bg-yellow-500 text-black',
      finished: 'bg-red-500 text-white',
      past: 'bg-gray-500 text-white'
    };

    const labels = {
      upcoming: 'BEVORSTEHEND',
      starting_soon: 'BEGINNT BALD',
      live: 'LÄUFT GERADE',
      ending_soon: 'ENDET BALD',
      finished: 'BEENDET',
      past: 'VERGANGEN'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getGenreColor = (genre: string) => {
    const colors = {
      'Rock': 'bg-rock',
      'Electronic': 'bg-electronic', 
      'Jazz': 'bg-jazz',
      'Classical': 'bg-classical',
      'Folk': 'bg-folk'
    };
    return colors[genre as keyof typeof colors] || 'bg-primary';
  };

  const getDetailedStatus = (startTime: string, endTime?: string) => {
    if (!endTime) return "Event";
    
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Calculate time differences in minutes
    const minutesToStart = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
    const minutesToEnd = Math.floor((end.getTime() - now.getTime()) / (1000 * 60));
    const minutesSinceEnd = Math.floor((now.getTime() - end.getTime()) / (1000 * 60));
    
    // Event hasn't started yet
    if (now < start) {
      if (minutesToStart <= 180) { // 3 hours
        const hours = Math.floor(minutesToStart / 60);
        if (hours >= 1) {
          return `Beginnt in ${hours}h`;
        }
        return `Beginnt in ${minutesToStart} Min`;
      }
      return "Bevorstehendes Event";
    }
    
    // Event is currently happening
    if (now >= start && now <= end) {
      if (minutesToEnd <= 5) {
        return "Endet in wenigen Minuten";
      }
      const hours = Math.floor(minutesToEnd / 60);
      if (hours >= 1) {
        return `Läuft noch ${hours}h`;
      }
      return `Läuft noch ${minutesToEnd} Min`;
    }
    
    // Event has ended
    if (now > end) {
      if (minutesSinceEnd <= 180) { // 3 hours
        const hours = Math.floor(minutesSinceEnd / 60);
        if (hours >= 1) {
          return `Beendet vor ${hours}h`;
        }
        return `Beendet vor ${minutesSinceEnd} Min`;
      }
      return "Beendet";
    }
    
    return "Event";
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
          <div className="flex items-center gap-2">
            {getStatusBadge(eventData.status)}
            {(['starting_soon', 'live', 'ending_soon', 'finished'].includes(eventData.status)) && (
              <div className={`flex items-center gap-1 text-sm animate-pulse ${
                eventData.status === 'starting_soon' ? 'text-orange-500' :
                eventData.status === 'live' ? 'text-green-500' :
                eventData.status === 'ending_soon' ? 'text-yellow-600' :
                eventData.status === 'finished' ? 'text-red-500' : ''
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  eventData.status === 'starting_soon' ? 'bg-orange-500' :
                  eventData.status === 'live' ? 'bg-green-500' :
                  eventData.status === 'ending_soon' ? 'bg-yellow-500' :
                  eventData.status === 'finished' ? 'bg-red-500' : ''
                }`}></div>
                {eventData.status === 'starting_soon' ? 'BEGINNT BALD' :
                 eventData.status === 'live' ? 'LÄUFT GERADE' :
                 eventData.status === 'ending_soon' ? 'ENDET BALD' :
                 eventData.status === 'finished' ? 'BEENDET' : ''}
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="hover:bg-muted/50 relative z-10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Hero Image */}
          {eventData.images.length > 0 && (
            <div className="relative rounded-lg overflow-hidden aspect-video bg-gradient-card">
              <img 
                src={eventData.images[0]} 
                alt={eventData.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            </div>
          )}

          {/* Title & Info */}
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold gradient-text">{eventData.title}</h1>
              <p className="text-lg text-muted-foreground">{eventData.subtitle}</p>
            </div>

            {/* Time & Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1 text-sm">
                  {/* Start Date & Time */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">Start:</span>
                    <span className="font-medium">
                      {new Date(eventData.startTime).toLocaleDateString('de-DE', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>{new Date(eventData.startTime).toLocaleTimeString('de-DE', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}</span>
                  </div>
                  
                  {/* End Date & Time */}
                  {eventData.endTime && (() => {
                    const startDate = new Date(eventData.startTime).toDateString();
                    const endDate = new Date(eventData.endTime).toDateString();
                    const isMultiDay = startDate !== endDate;
                    
                    return (
                      <>
                        <div className={`flex items-center gap-2 ${isMultiDay ? 'mt-2 pt-2 border-t border-border' : 'mt-1'}`}>
                          <Calendar className="w-4 h-4 text-secondary" />
                          <span className="font-medium text-secondary">Ende:</span>
                          {isMultiDay && (
                            <span className="font-medium">
                              {new Date(eventData.endTime).toLocaleDateString('de-DE', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short', 
                                day: 'numeric'
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-6">
                          <Clock className="w-4 h-4 text-secondary" />
                          <span>
                            {new Date(eventData.endTime).toLocaleTimeString('de-DE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs font-medium",
                    eventData.status === 'upcoming' && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                    eventData.status === 'starting_soon' && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                    eventData.status === 'live' && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                    eventData.status === 'ending_soon' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                    eventData.status === 'finished' && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                    eventData.status === 'past' && "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                  )}
                >
                  {getDetailedStatus(eventData.startTime, eventData.endTime)}
                </Badge>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary mt-0.5" />
                <span className="text-muted-foreground">{eventData.location}</span>
              </div>
            </div>

            {/* Stats */}
            {(eventData.rating || eventData.attendees) && (
              <div className="flex items-center gap-4 text-sm">
                {eventData.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent fill-current" />
                    <span>{eventData.rating.toFixed(1)}</span>
                  </div>
                )}
                {eventData.attendees && (
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{eventData.attendees} Teilnehmer</span>
                  </div>
                )}
              </div>
            )}

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {eventData.genres.map((genre) => (
                <Badge 
                  key={genre}
                  variant="secondary"
                  className={cn("text-xs", getGenreColor(genre))}
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant={eventData.isFavorite ? "default" : "outline"}
              className="justify-start gap-2 relative z-0"
            >
              <Heart className={cn("w-4 h-4", eventData.isFavorite && "fill-current")} />
              Merken
            </Button>
            <Button variant="outline" className="justify-start gap-2 relative z-0">
              <Share2 className="w-4 h-4" />
              Teilen
            </Button>
          </div>

          {/* Event Creator Actions */}
          {isEventCreator && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Event verwalten</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start gap-2 relative z-0"
                    onClick={() => onEdit?.(eventData.id)}
                  >
                    <Edit className="w-4 h-4" />
                    Bearbeiten
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start gap-2 text-destructive hover:text-destructive relative z-0"
                    onClick={() => onDelete?.(eventData.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Löschen
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Links */}
          {(eventData.ticketUrl || eventData.websiteUrl) && (
            <div className="space-y-3">
              <Separator />
              <div className="space-y-2">
                {eventData.ticketUrl && (
                  <Button variant="default" className="w-full justify-start gap-2 relative z-0">
                    <ExternalLink className="w-4 h-4" />
                    Tickets kaufen
                  </Button>
                )}
                {eventData.websiteUrl && (
                  <Button variant="outline" className="w-full justify-start gap-2 relative z-0">
                    <ExternalLink className="w-4 h-4" />
                    Website besuchen
                  </Button>
                )}
                <Button variant="outline" className="w-full justify-start gap-2 relative z-0">
                  <MapPin className="w-4 h-4" />
                  Route öffnen
                </Button>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Beschreibung</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {eventData.description}
              </p>
            </div>
          </div>

          {/* Reminder */}
          {eventData.status === 'upcoming' && (
            <div className="space-y-3">
              <Separator />
              <Button variant="outline" className="w-full justify-start gap-2 relative z-0">
                <Calendar className="w-4 h-4" />
                Erinnerung setzen
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InfoPanel;