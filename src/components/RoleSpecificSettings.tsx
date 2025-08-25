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
  UserCog
} from 'lucide-react';

interface RoleSpecificSettingsProps {
  userProfile: any;
  role: string;
}

const RoleSpecificSettings: React.FC<RoleSpecificSettingsProps> = ({ userProfile, role }) => {
  if (role === 'artist') {
    return (
      <>
        {/* Artist Portfolio */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="w-5 h-5 text-primary" />
              Künstler-Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Künstlername</label>
              <p className="font-medium">{userProfile?.display_name || 'Nicht angegeben'}</p>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Bio</label>
              <p className="text-sm">{userProfile?.bio || 'Keine Bio hinzugefügt'}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Genres</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(userProfile?.preferred_genres && userProfile.preferred_genres.length > 0) ? (
                  userProfile.preferred_genres.map((genre: string) => (
                    <Badge key={genre} variant="secondary" className="bg-primary/10 text-primary">
                      {genre}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Keine Genres ausgewählt</span>
                )}
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Portfolio bearbeiten
            </Button>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-primary" />
              Social Media & Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Globe, label: 'Website', placeholder: 'https://deine-website.de' },
              { icon: Instagram, label: 'Instagram', placeholder: '@deinusername' },
              { icon: Youtube, label: 'YouTube', placeholder: 'YouTube Kanal' },
              { icon: Music, label: 'Spotify', placeholder: 'Spotify Artist Profil' },
            ].map((link) => (
              <div key={link.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <link.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{link.label}</span>
                </div>
                <Button variant="ghost" size="sm">Hinzufügen</Button>
              </div>
            ))}
          </CardContent>
        </Card>

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