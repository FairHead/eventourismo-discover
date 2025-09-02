import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ExternalLink, X, Calendar } from 'lucide-react';
import type { Venue as AggregatedVenue } from '@/types/venues';

interface AggregatedVenueInfoPanelProps {
  venue: AggregatedVenue;
  onClose: () => void;
  onNavigate?: (coords: [number, number], name: string) => void;
}

const AggregatedVenueInfoPanel: React.FC<AggregatedVenueInfoPanelProps> = ({ venue, onClose, onNavigate }) => {
  const handleNavigate = () => {
    onNavigate?.([venue.lng, venue.lat], venue.name);
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'osm': return 'bg-green-100 text-green-800 border-green-200';
      case 'eventourismo': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ticketmaster': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'eventbrite': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSourceName = (source: string) => {
    switch (source) {
      case 'osm': return 'OpenStreetMap';
      case 'eventourismo': return 'Eventourismo';
      case 'ticketmaster': return 'Ticketmaster';
      case 'eventbrite': return 'Eventbrite';
      default: return source.toUpperCase();
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <Card className="shadow-xl border-border/50 backdrop-blur-sm bg-background/95">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold text-foreground truncate">
                {venue.name}
              </CardTitle>
              {venue.city && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{venue.city}</span>
                  {venue.country && venue.country !== 'DE' && (
                    <span>, {venue.country}</span>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {venue.address && (
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Adresse</h4>
              <p className="text-sm text-muted-foreground">
                {venue.address}
              </p>
            </div>
          )}

          {venue.category && (
            <div>
              <h4 className="font-medium text-sm text-foreground mb-2">Kategorie</h4>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  {venue.category.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          )}

          {venue.sources && venue.sources.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-foreground mb-2">Datenquellen</h4>
              <div className="flex flex-wrap gap-1">
                {venue.sources.map((source, index) => (
                  <Badge 
                    key={index}
                    className={`text-xs ${getSourceBadgeColor(source.source)}`}
                    variant="outline"
                  >
                    {getSourceName(source.source)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {onNavigate && (
              <Button onClick={handleNavigate} size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                <MapPin className="w-4 h-4 mr-2" />
                Navigation
              </Button>
            )}
            {venue.website && (
              <Button asChild variant="outline" size="sm" className="flex-1 border-border hover:bg-accent">
                <a href={venue.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Website
                </a>
              </Button>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              <span>Events werden demnächst angezeigt</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AggregatedVenueInfoPanel;
