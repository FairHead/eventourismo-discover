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
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventData {
  id: string;
  title: string;
  subtitle: string;
  type: 'event' | 'venue';
  status: 'live' | 'upcoming' | 'past';
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
}

interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  eventData?: EventData;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ isOpen, onClose, eventData }) => {
  if (!eventData) return null;

  const getStatusBadge = (status: string) => {
    const variants = {
      live: 'bg-live text-live-foreground',
      upcoming: 'bg-upcoming text-upcoming-foreground', 
      past: 'bg-past text-past-foreground'
    };

    const labels = {
      live: 'LIVE',
      upcoming: 'Bevorstehend',
      past: 'Vergangen'
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
            {eventData.status === 'live' && (
              <div className="flex items-center gap-1 text-live text-sm animate-pulse">
                <div className="w-2 h-2 bg-live rounded-full"></div>
                LÄUFT JETZT
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
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span>{eventData.startTime}</span>
                {eventData.endTime && <span>- {eventData.endTime}</span>}
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