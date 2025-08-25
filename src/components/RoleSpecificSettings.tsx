import React, { useState, useEffect } from 'react';
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
  Euro,
  Plus,
  UserPlus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import BandProfileModal from './BandProfileModal';
import BandInvitationModal from './BandInvitationModal';
import BandInvitations from './BandInvitations';

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
  const { user } = useAuth();
  const [bands, setBands] = useState<any[]>([]);
  const [showBandModal, setShowBandModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedBand, setSelectedBand] = useState<any>(null);
  const [selectedBandForInvite, setSelectedBandForInvite] = useState<any>(null);

  const fetchUserBands = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('band_members')
        .select(`
          *,
          bands (
            id,
            name,
            bio,
            city,
            avatar_url,
            social_links,
            website_url,
            genres,
            slug,
            created_by
          )
        `)
        .eq('artist_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setBands(data?.map(m => ({ ...m.bands, memberRole: m.role })) || []);
    } catch (error) {
      console.error('Error fetching bands:', error);
    }
  };

  useEffect(() => {
    if (role === 'artist') {
      fetchUserBands();
    }
  }, [user, role]);

  const handleBandSuccess = () => {
    fetchUserBands();
    setSelectedBand(null);
  };

  const handleEditBand = (band: any) => {
    setSelectedBand(band);
    setShowBandModal(true);
  };

  const handleInviteArtists = (band: any) => {
    setSelectedBandForInvite(band);
    setShowInviteModal(true);
  };

  const handleInviteSuccess = () => {
    setSelectedBandForInvite(null);
  };
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Website</span>
                </div>
                {artistProfile.website_url ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={artistProfile.website_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={onEditArtistProfile}>
                    Hinzufügen
                  </Button>
                )}
              </div>

              {/* Social Media Links */}
              <Separator />
              <div className="space-y-2">
                {/* Instagram */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <span className="text-sm">Instagram</span>
                  </div>
                  {artistProfile.social_links?.instagram ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={artistProfile.social_links.instagram} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onEditArtistProfile}>
                      Hinzufügen
                    </Button>
                  )}
                </div>

                {/* Spotify */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Spotify</span>
                  </div>
                  {artistProfile.social_links?.spotify ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={artistProfile.social_links.spotify} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onEditArtistProfile}>
                      Hinzufügen
                    </Button>
                  )}
                </div>

                {/* YouTube */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-500" />
                    <span className="text-sm">YouTube</span>
                  </div>
                  {artistProfile.social_links?.youtube ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={artistProfile.social_links.youtube} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onEditArtistProfile}>
                      Hinzufügen
                    </Button>
                  )}
                </div>

                {/* SoundCloud */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                      <span className="text-white text-xs font-bold">S</span>
                    </div>
                    <span className="text-sm">SoundCloud</span>
                  </div>
                  {artistProfile.social_links?.soundcloud ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={artistProfile.social_links.soundcloud} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onEditArtistProfile}>
                      Hinzufügen
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bands */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Meine Bands
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBandModal(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bands.length > 0 ? (
              bands.map((band) => (
                <div key={band.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      {band.avatar_url ? (
                        <img
                          src={band.avatar_url}
                          alt={band.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <Users className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{band.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {band.memberRole === 'admin' ? 'Admin' : 
                           band.memberRole === 'manager' ? 'Manager' : 'Mitglied'}
                        </Badge>
                      </div>
                      {band.city && (
                        <p className="text-sm text-muted-foreground">{band.city}</p>
                      )}
                      {band.bio && (
                        <p className="text-sm text-muted-foreground mt-1">{band.bio}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {(band.created_by === user?.id || band.memberRole === 'admin' || band.memberRole === 'manager') && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditBand(band)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInviteArtists(band)}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {band.genres && band.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {band.genres.slice(0, 3).map((genre: string) => (
                        <Badge key={genre} variant="outline" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                      {band.genres.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{band.genres.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    {band.website_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={band.website_url} target="_blank" rel="noopener noreferrer">
                          <Globe className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {band.social_links?.instagram && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={band.social_links.instagram} target="_blank" rel="noopener noreferrer">
                          <Instagram className="w-4 h-4 text-pink-500" />
                        </a>
                      </Button>
                    )}
                    {band.social_links?.youtube && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={band.social_links.youtube} target="_blank" rel="noopener noreferrer">
                          <Youtube className="w-4 h-4 text-red-500" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Noch keine Bands</p>
                <Button
                  variant="outline"
                  onClick={() => setShowBandModal(true)}
                  className="mt-2"
                >
                  Erste Band gründen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Band Invitations */}
        <BandInvitations onUpdate={fetchUserBands} />

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

        {/* Band Modals */}
        <BandProfileModal
          isOpen={showBandModal}
          onClose={() => {
            setShowBandModal(false);
            setSelectedBand(null);
          }}
          onSuccess={handleBandSuccess}
          existingBand={selectedBand}
        />

        {selectedBandForInvite && (
          <BandInvitationModal
            isOpen={showInviteModal}
            onClose={() => {
              setShowInviteModal(false);
              setSelectedBandForInvite(null);
            }}
            onSuccess={handleInviteSuccess}
            bandId={selectedBandForInvite.id}
            bandName={selectedBandForInvite.name}
          />
        )}
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