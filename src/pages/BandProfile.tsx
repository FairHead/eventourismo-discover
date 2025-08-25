import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  MapPin, 
  Calendar,
  Globe,
  Instagram,
  Youtube,
  Music,
  ExternalLink,
  ArrowLeft,
  Edit,
  UserPlus,
  Mail
} from 'lucide-react';
import BandProfileModal from '@/components/BandProfileModal';
import BandInvitationModal from '@/components/BandInvitationModal';

const BandProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [band, setBand] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userMembership, setUserMembership] = useState<any>(null);

  const fetchBandData = async () => {
    if (!slug) return;

    try {
      // Fetch band info
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single();

      if (bandError) throw bandError;
      setBand(bandData);

      // Fetch band members
      const { data: membersData, error: membersError } = await supabase
        .from('band_members')
        .select(`
          *,
          artist_profiles (
            stage_name,
            bio,
            avatar_url,
            genres,
            instruments,
            users (
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .eq('band_id', bandData.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Check if current user is a member
      if (user) {
        const userMember = membersData?.find(m => m.artist_id === user.id);
        setUserMembership(userMember || null);
      }

    } catch (error) {
      console.error('Error fetching band data:', error);
      toast({
        title: "Fehler",
        description: "Band-Profil konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandData();
  }, [slug, user]);

  const canEdit = () => {
    return user && (
      band?.created_by === user.id || 
      userMembership?.role === 'admin' || 
      userMembership?.role === 'manager'
    );
  };

  const canInvite = () => {
    return canEdit();
  };

  const handleEditSuccess = () => {
    fetchBandData();
  };

  if (loading) {
    return (
      <div className="pb-20 px-4 py-6 space-y-6 min-h-screen bg-background">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="pb-20 px-4 py-6 min-h-screen bg-background">
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Band nicht gefunden</h2>
          <p className="text-muted-foreground mb-4">
            Die gesuchte Band existiert nicht oder ist nicht mehr aktiv.
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück zur Startseite
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 px-4 py-6 space-y-6 min-h-screen bg-background">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Zurück
          </Link>
        </Button>
      </div>

      {/* Band Header */}
      <Card className="bg-gradient-card border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              {band.avatar_url ? (
                <img
                  src={band.avatar_url}
                  alt={band.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <Users className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{band.name}</h1>
                {canEdit() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(true)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
                {canInvite() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                {band.city && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{band.city}, {band.country}</span>
                  </div>
                )}
                {band.formation_year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Gegründet {band.formation_year}</span>
                  </div>
                )}
              </div>
              {band.bio && (
                <p className="text-muted-foreground">{band.bio}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Genres */}
      {band.genres && band.genres.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="w-5 h-5 text-primary" />
              Musikrichtungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {band.genres.map((genre: string) => (
                <Badge key={genre} variant="secondary" className="bg-primary/10 text-primary">
                  {genre}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {band.description && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Über die Band</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{band.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Social Links & Website */}
      {(band.website_url || band.social_links) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-primary" />
              Links & Social Media
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {band.website_url && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Website</span>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={band.website_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            )}

            {band.social_links && (
              <>
                {band.social_links.instagram && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-500" />
                      <span className="text-sm">Instagram</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={band.social_links.instagram} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                )}
                {band.social_links.youtube && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      <span className="text-sm">YouTube</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={band.social_links.youtube} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                )}
                {band.social_links.spotify && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Spotify</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={band.social_links.spotify} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                )}
                {band.social_links.soundcloud && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">S</span>
                      </div>
                      <span className="text-sm">SoundCloud</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={band.social_links.soundcloud} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Band Members */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Bandmitglieder ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                {(member.artist_profiles?.avatar_url || member.artist_profiles?.users?.avatar_url) ? (
                  <img
                    src={member.artist_profiles.avatar_url || member.artist_profiles.users.avatar_url}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <Music className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">
                    {member.artist_profiles?.stage_name || 
                     member.artist_profiles?.users?.display_name ||
                     `${member.artist_profiles?.users?.first_name} ${member.artist_profiles?.users?.last_name}`}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {member.role === 'admin' ? 'Admin' :
                     member.role === 'manager' ? 'Manager' : 'Mitglied'}
                  </Badge>
                </div>
                {member.artist_profiles?.bio && (
                  <p className="text-sm text-muted-foreground">{member.artist_profiles.bio}</p>
                )}
                {member.instruments && member.instruments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.instruments.map((instrument: string) => (
                      <Badge key={instrument} variant="secondary" className="text-xs">
                        {instrument}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Seit {new Date(member.joined_at).toLocaleDateString('de-DE')}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modals */}
      <BandProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
        existingBand={band}
      />

      {showInviteModal && (
        <BandInvitationModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {}}
          bandId={band.id}
          bandName={band.name}
        />
      )}
    </div>
  );
};

export default BandProfile;