import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ExternalLink, X, Calendar, Users } from 'lucide-react';
import type { Venue } from '@/hooks/useVenues';

interface VenueInfoPanelProps {
  venue: Venue;
  onClose: () => void;
  onNavigate?: (coords: [number, number], name: string) => void;
}

const VenueInfoPanel: React.FC<VenueInfoPanelProps> = ({ venue, onClose, onNavigate }) => {
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate([venue.lng, venue.lat], venue.name);
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'osm': return 'bg-green-100 text-green-800 border-green-200';
      case 'tm': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'eb': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSourceName = (source: string) => {
    switch (source) {
      case 'osm': return 'OpenStreetMap';
      case 'tm': return 'Ticketmaster';
      case 'eb': return 'Eventbrite';
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
          {/* Address */}
          {venue.address && (
            <div>
              <h4 className="font-medium text-sm text-foreground mb-1">Adresse</h4>
              <p className="text-sm text-muted-foreground">
                {typeof venue.address === 'string' ? venue.address : JSON.stringify(venue.address)}
              </p>
            </div>
          )}
          
          {/* Categories */}
          {venue.categories && venue.categories.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-foreground mb-2">Kategorien</h4>
              <div className="flex flex-wrap gap-1">
                {venue.categories.map((category, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {category.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Data Sources */}
          {venue.sources && venue.sources.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-foreground mb-2">Datenquellen</h4>
              <div className="flex flex-wrap gap-1">
                {venue.sources.map((source, index) => (
                  <Badge 
                    key={index} 
                    className={`text-xs ${getSourceBadgeColor(source.src)}`}
                    variant="outline"
                  >
                    {getSourceName(source.src)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {onNavigate && (
              <Button
                onClick={handleNavigate}
                size="sm"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Navigation
              </Button>
            )}
            
            {venue.website && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex-1 border-border hover:bg-accent"
              >
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Website
                </a>
              </Button>
            )}
          </div>
          
          {/* TODO: Events at this venue */}
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

export default VenueInfoPanel;