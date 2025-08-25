import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Music, 
  Users, 
  Building, 
  Phone, 
  Globe, 
  Instagram, 
  Youtube,
  MapPin,
  Calendar,
  Settings,
  Shield,
  BarChart,
  UserCog,
  Mail,
  Edit,
  ExternalLink,
  Clock,
  Euro
} from 'lucide-react';

interface RoleSpecificSettingsProps {
  userProfile: any;
  artistProfile?: any;
  role: string;
  onEditArtistProfile?: () => void;
}

const RoleSpecificSettings: React.FC<RoleSpecificSettingsProps> = ({ 
  userProfile, 
  artistProfile, 
  role, 
  onEditArtistProfile 
}) => {
  if (role === 'artist') {
    return (
      <>
        {/* Artist Portfolio */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                Künstler-Portfolio
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onEditArtistProfile}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {artistProfile ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Künstlername</label>
                  <p className="font-medium">{artistProfile.stage_name}</p>
                </div>
                
                {artistProfile.bio && (
                  <div>
                    <label className="text-sm text-muted-foreground">Bio</label>
                    <p className="text-sm">{artistProfile.bio}</p>
                  </div>
                )}

                {artistProfile.genres && artistProfile.genres.length > 0 && (
                  <div>
                    <label className="text-sm text-muted-foreground">Genres</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {artistProfile.genres.map((genre: string) => (
                        <Badge key={genre} variant="secondary" className="bg-primary/10 text-primary">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {artistProfile.instruments && artistProfile.instruments.length > 0 && (
                  <div>
                    <label className="text-sm text-muted-foreground">Instrumente</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {artistProfile.instruments.map((instrument: string) => (
                        <Badge key={instrument} variant="outline">
                          {instrument}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(artistProfile.experience_years || artistProfile.price_range) && (
                  <div className="grid grid-cols-2 gap-4">
                    {artistProfile.experience_years && (
                      <div>
                        <label className="text-sm text-muted-foreground">Erfahrung</label>
                        <p className="text-sm flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {artistProfile.experience_years} Jahre
                        </p>
                      </div>
                    )}
                    {artistProfile.price_range && (
                      <div>
                        <label className="text-sm text-muted-foreground">Preisklasse</label>
                        <p className="text-sm flex items-center gap-1">
                          <Euro className="w-4 h-4" />
                          {artistProfile.price_range}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(artistProfile.city || artistProfile.performance_radius_km) && (
                  <div>
                    <label className="text-sm text-muted-foreground">Standort & Aktionsradius</label>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {artistProfile.city && `${artistProfile.city} `}
                      {artistProfile.performance_radius_km && `(${artistProfile.performance_radius_km} km Radius)`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Noch kein Künstler-Profil erstellt</p>
                <Button
                  variant="outline"
                  onClick={onEditArtistProfile}
                  className="mt-2"
                >
                  Profil erstellen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Social Links & Contact */}
        {artistProfile && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5 text-primary" />
                Kontakt & Social Media
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Contact Information */}
              {(artistProfile.contact_email || artistProfile.phone_number) && (
                <div className="space-y-2">
                  {artistProfile.contact_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{artistProfile.contact_email}</span>
                    </div>
                  )}
                  {artistProfile.phone_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{artistProfile.phone_number}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Website */}
              {artistProfile.website_url && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Website</span>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={artistProfile.website_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              )}

              {/* Social Media Links */}
              {artistProfile.social_links && Object.keys(artistProfile.social_links).some(key => artistProfile.social_links[key]) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {artistProfile.social_links.instagram && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Instagram className="w-4 h-4 text-pink-500" />
                          <span className="text-sm">Instagram</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={artistProfile.social_links.instagram} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                    {artistProfile.social_links.spotify && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-green-500" />
                          <span className="text-sm">Spotify</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={artistProfile.social_links.spotify} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                    {artistProfile.social_links.youtube && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Youtube className="w-4 h-4 text-red-500" />
                          <span className="text-sm">YouTube</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={artistProfile.social_links.youtube} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                    {artistProfile.social_links.soundcloud && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                            <span className="text-white text-xs font-bold">S</span>
                          </div>
                          <span className="text-sm">SoundCloud</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={artistProfile.social_links.soundcloud} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Performance Stats */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart className="w-5 h-5 text-primary" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Auftritte</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">0</div>
                <div className="text-xs text-muted-foreground">Follower</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (role === 'promoter') {
    return (
      <>
        {/* Company Info */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="w-5 h-5 text-primary" />
              Veranstalter-Informationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Firmenname</label>
              <p className="font-medium">{userProfile?.display_name || 'Nicht angegeben'}</p>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Beschreibung</label>
              <p className="text-sm">{userProfile?.bio || 'Keine Beschreibung hinzugefügt'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Telefon</label>
                <p className="text-sm">{userProfile?.phone_number || 'Nicht angegeben'}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Website</label>
                <p className="text-sm">Nicht angegeben</p>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Informationen bearbeiten
            </Button>
          </CardContent>
        </Card>

        {/* Event Management */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Event-Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Aktive Events</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">0</div>
                <div className="text-xs text-muted-foreground">Geplante Events</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-secondary">0</div>
                <div className="text-xs text-muted-foreground">Venues</div>
              </div>
            </div>
            <Separator />
            <Button variant="outline" className="w-full">
              Events verwalten
            </Button>
          </CardContent>
        </Card>

        {/* Venue Management */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-primary" />
              Venue-Verwaltung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verwalten Sie Ihre Veranstaltungsorte und deren Details.
            </p>
            <Button variant="outline" className="w-full">
              Venues verwalten
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  if (role === 'admin') {
    return (
      <>
        {/* Admin Controls */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              Administrator-Bereich
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Benutzer</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">0</div>
                <div className="text-xs text-muted-foreground">Berichte</div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <UserCog className="w-4 h-4" />
                Benutzer verwalten
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <BarChart className="w-4 h-4" />
                System-Analytics
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Settings className="w-4 h-4" />
                System-Einstellungen
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // Default user settings
  return (
    <>
      {/* Personal Preferences */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            Persönliche Einstellungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Event-Benachrichtigungen</label>
            <p className="text-sm">Aktiviert für alle Genres</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Umkreis für Events</label>
            <p className="text-sm">50 km um Ihren Standort</p>
          </div>
          <Button variant="outline" className="w-full">
            Einstellungen bearbeiten
          </Button>
        </CardContent>
      </Card>
    </>
  );
};

export default RoleSpecificSettings;