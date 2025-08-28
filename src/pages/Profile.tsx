import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import ProfilePictureUpload from '@/components/ProfilePictureUpload';
import RoleSpecificSettings from '@/components/RoleSpecificSettings';
import ArtistProfileModal from '@/components/ArtistProfileModal';
import FavoritesDashboard from '@/components/FavoritesDashboard';
import { useNavigate } from 'react-router-dom';
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
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [artistProfile, setArtistProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showArtistModal, setShowArtistModal] = useState(false);

  const preferredGenres = ['Electronic', 'Jazz', 'Rock', 'Classical'];
  const stats = {
    eventsAttended: 42,
    favoriteVenues: 8,
    reviewsWritten: 15
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchArtistProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArtistProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setArtistProfile(data);
    } catch (error) {
      console.error('Error fetching artist profile:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Erfolgreich abgemeldet",
        description: "Sie wurden erfolgreich abgemeldet.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Abmelden",
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'artist': return 'Künstler';
      case 'promoter': return 'Veranstalter';
      case 'admin': return 'Administrator';
      default: return 'Event-Besucher';
    }
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    setUserProfile(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : null);
  };

  const handleArtistProfileSuccess = () => {
    fetchUserProfile();
    fetchArtistProfile();
  };

  const handleBecomeArtist = () => {
    setShowArtistModal(true);
  };

  if (loading) {
    return (
      <div className="pb-20 px-4 py-6 space-y-6 min-h-screen bg-background">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 px-4 py-6 space-y-6 min-h-screen bg-background">
      {/* Profile Header */}
      <Card className="bg-gradient-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <ProfilePictureUpload
              currentAvatarUrl={userProfile?.avatar_url}
              displayName={userProfile?.display_name || `${userProfile?.first_name} ${userProfile?.last_name}` || ''}
              onAvatarUpdate={handleAvatarUpdate}
            />
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{userProfile?.display_name || `${userProfile?.first_name} ${userProfile?.last_name}` || user?.email}</h2>
              <p className="text-muted-foreground">{getRoleDisplayName(userProfile?.role)} {userProfile?.city && `aus ${userProfile?.city}`}</p>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{userProfile?.city ? `${userProfile.city}, ${userProfile.country || 'Deutschland'}` : 'Standort nicht angegeben'}</span>
              </div>
              {userProfile?.bio && (
                <p className="text-sm text-muted-foreground mt-2 italic">{userProfile.bio}</p>
              )}
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

      {/* User Details */}
      {userProfile && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Persönliche Informationen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Benutzername:</span>
                <p className="font-medium">{userProfile.username || 'Nicht angegeben'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">E-Mail:</span>
                <p className="font-medium">{user?.email}</p>
              </div>
              {userProfile.phone_number && (
                <div>
                  <span className="text-muted-foreground">Telefon:</span>
                  <p className="font-medium">{userProfile.phone_number}</p>
                </div>
              )}
              {userProfile.date_of_birth && (
                <div>
                  <span className="text-muted-foreground">Geburtsdatum:</span>
                  <p className="font-medium">{new Date(userProfile.date_of_birth).toLocaleDateString('de-DE')}</p>
                </div>
              )}
            </div>
            {(userProfile.street_address || userProfile.postal_code) && (
              <div className="pt-2 border-t border-border">
                <span className="text-muted-foreground text-sm">Adresse:</span>
                <div className="mt-1">
                  {userProfile.street_address && <p className="text-sm">{userProfile.street_address}</p>}
                  {(userProfile.postal_code || userProfile.city) && (
                    <p className="text-sm">{userProfile.postal_code} {userProfile.city}</p>
                  )}
                  {userProfile.country && userProfile.country !== 'Deutschland' && (
                    <p className="text-sm">{userProfile.country}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="w-5 h-5 text-primary" />
            Lieblings-Genres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(userProfile?.preferred_genres && userProfile.preferred_genres.length > 0) ? (
              userProfile.preferred_genres.map((genre: string) => (
                <Badge key={genre} variant="secondary" className="bg-primary/10 text-primary">
                  {genre}
                </Badge>
              ))
            ) : (
              preferredGenres.map((genre) => (
                <Badge key={genre} variant="secondary" className="bg-primary/10 text-primary">
                  {genre}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role-specific Settings */}
      {userProfile && (
        <RoleSpecificSettings 
          userProfile={userProfile} 
          artistProfile={artistProfile}
          role={userProfile.role} 
          onEditArtistProfile={() => setShowArtistModal(true)}
        />
      )}

      {/* Favorites Dashboard */}
      <FavoritesDashboard />

      {/* Menu Items */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="space-y-0">
            {[
              { icon: Calendar, label: 'Meine Events', path: '/my-events' },
              { icon: Bell, label: 'Benachrichtigungen', path: '/notifications' },
              { icon: Settings, label: 'Einstellungen', path: '/settings' },
              { icon: Shield, label: 'Datenschutz', path: '/privacy' },
            ].map((item, index) => (
              <React.Fragment key={item.label}>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-4 h-auto rounded-none hover:bg-muted/50"
                  onClick={() => navigate(item.path)}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>
                {index < 3 && <Separator className="mx-4" />}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Switch */}
      {userProfile?.role !== 'artist' && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Als Künstler anmelden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Erstellen Sie Ihr Künstler-Profil und werden Sie Teil unserer Musik-Community.
            </p>
            <Button 
              variant="default" 
              className="w-full"
              onClick={handleBecomeArtist}
            >
              <Music className="w-4 h-4 mr-2" />
              Künstler werden
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <Card className="border-destructive/20">
        <CardContent className="p-4">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Abmelden
          </Button>
        </CardContent>
      </Card>

      {/* Artist Profile Modal */}
      <ArtistProfileModal
        isOpen={showArtistModal}
        onClose={() => setShowArtistModal(false)}
        onSuccess={handleArtistProfileSuccess}
        existingProfile={artistProfile}
      />
    </div>
  );
};

export default Profile;