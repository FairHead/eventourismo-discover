import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Settings, 
  Heart, 
  Calendar,
  MapPin,
  Music,
  Bell,
  Shield,
  LogOut,
  ChevronRight
} from 'lucide-react';

const Profile: React.FC = () => {
  const preferredGenres = ['Electronic', 'Jazz', 'Rock', 'Classical'];
  const stats = {
    eventsAttended: 42,
    favoriteVenues: 8,
    reviewsWritten: 15
  };

  return (
    <div className="pb-20 px-4 py-6 space-y-6 min-h-screen bg-background">
      {/* Profile Header */}
      <Card className="bg-gradient-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Max Mustermann</h2>
              <p className="text-muted-foreground">Musikliebhaber aus Berlin</p>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>Berlin, Deutschland</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.eventsAttended}</div>
            <div className="text-xs text-muted-foreground">Events besucht</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.favoriteVenues}</div>
            <div className="text-xs text-muted-foreground">Lieblings-Venues</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-secondary">{stats.reviewsWritten}</div>
            <div className="text-xs text-muted-foreground">Bewertungen</div>
          </CardContent>
        </Card>
      </div>

      {/* Preferred Genres */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="w-5 h-5 text-primary" />
            Lieblings-Genres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {preferredGenres.map((genre) => (
              <Badge key={genre} variant="secondary" className="bg-primary/10 text-primary">
                {genre}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="space-y-0">
            {[
              { icon: Heart, label: 'Meine Favoriten', path: '/favorites' },
              { icon: Calendar, label: 'Meine Events', path: '/my-events' },
              { icon: Bell, label: 'Benachrichtigungen', path: '/notifications' },
              { icon: Settings, label: 'Einstellungen', path: '/settings' },
              { icon: Shield, label: 'Datenschutz', path: '/privacy' },
            ].map((item, index) => (
              <React.Fragment key={item.label}>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-4 h-auto rounded-none hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>
                {index < 4 && <Separator className="mx-4" />}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Switch */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Konto-Typ wechseln</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wechseln Sie zu einem Künstler- oder Veranstalter-Konto, um Events zu erstellen und zu verwalten.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1">
              Künstler werden
            </Button>
            <Button variant="outline" className="flex-1">
              Veranstalter werden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="border-destructive/20">
        <CardContent className="p-4">
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10">
            <LogOut className="w-5 h-5" />
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;