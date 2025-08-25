import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UserPlus,
  Search,
  X,
  Music
} from 'lucide-react';

interface BandInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bandId: string;
  bandName: string;
}

const INSTRUMENTS = [
  'Gesang', 'Gitarre', 'Bass', 'Schlagzeug', 'Klavier', 'Keyboard', 'Violine',
  'Saxophon', 'Trompete', 'Flöte', 'Cello', 'Kontrabass', 'Harmonika',
  'DJ-Equipment', 'Synthesizer', 'Ukulele', 'Banjo', 'Mandoline'
];

const ROLES = [
  { value: 'member', label: 'Mitglied' },
  { value: 'manager', label: 'Manager' }
];

const BandInvitationModal: React.FC<BandInvitationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bandId,
  bandName
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Form state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);

  // Search for artists
  const searchArtists = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('artist_profiles')
        .select(`
          *,
          users!inner (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .or(`stage_name.ilike.%${term}%,users.display_name.ilike.%${term}%,users.first_name.ilike.%${term}%,users.last_name.ilike.%${term}%`)
        .limit(10);

      if (error) throw error;

      // Filter out artists already in the band
      const { data: existingMembers } = await supabase
        .from('band_members')
        .select('artist_id')
        .eq('band_id', bandId)
        .eq('is_active', true);

      const existingMemberIds = existingMembers?.map(m => m.artist_id) || [];
      const filteredResults = data?.filter(artist => !existingMemberIds.includes(artist.user_id)) || [];

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching artists:', error);
      toast({
        title: "Fehler",
        description: "Künstler konnten nicht gesucht werden.",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchArtists(searchTerm);
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleInstrumentToggle = (instrument: string) => {
    setSelectedInstruments(prev => 
      prev.includes(instrument) 
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
    );
  };

  const handleInvite = async () => {
    if (!user || !selectedArtist) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('band_invitations')
        .insert({
          band_id: bandId,
          inviter_id: user.id,
          invitee_id: selectedArtist.user_id,
          message: message.trim() || null,
          invited_role: selectedRole,
          invited_instruments: selectedInstruments,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Einladung versendet",
        description: `Einladung an ${selectedArtist.stage_name || selectedArtist.users.display_name} wurde erfolgreich versendet.`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      if (error.code === '23505') {
        toast({
          title: "Einladung bereits versendet",
          description: "An diesen Künstler wurde bereits eine Einladung versendet.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fehler",
          description: "Die Einladung konnte nicht versendet werden.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedArtist(null);
    setMessage('');
    setSelectedRole('member');
    setSelectedInstruments([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Künstler zu {bandName} einladen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!selectedArtist ? (
            <>
              {/* Artist Search */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Künstler suchen</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nach Künstlernamen suchen..."
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Search Results */}
                {searchLoading && (
                  <div className="text-center py-4">
                    <div className="animate-pulse">Suche...</div>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((artist) => (
                      <div
                        key={artist.user_id}
                        className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedArtist(artist)}
                      >
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                          {artist.users.avatar_url ? (
                            <img
                              src={artist.users.avatar_url}
                              alt="Avatar"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <Music className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {artist.stage_name || artist.users.display_name || 
                             `${artist.users.first_name} ${artist.users.last_name}`}
                          </p>
                          {artist.city && (
                            <p className="text-sm text-muted-foreground">{artist.city}</p>
                          )}
                          {artist.genres && artist.genres.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {artist.genres.slice(0, 3).map((genre: string) => (
                                <Badge key={genre} variant="secondary" className="text-xs">
                                  {genre}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm && !searchLoading && searchResults.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    Keine Künstler gefunden
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Selected Artist */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    {selectedArtist.users.avatar_url ? (
                      <img
                        src={selectedArtist.users.avatar_url}
                        alt="Avatar"
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {selectedArtist.stage_name || selectedArtist.users.display_name}
                    </p>
                    {selectedArtist.city && (
                      <p className="text-sm text-muted-foreground">{selectedArtist.city}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedArtist(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <Label>Rolle in der Band</Label>
                  <div className="flex gap-2">
                    {ROLES.map((role) => (
                      <Button
                        key={role.value}
                        variant={selectedRole === role.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedRole(role.value)}
                      >
                        {role.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Instruments */}
                <div className="space-y-2">
                  <Label>Instrumente (optional)</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {INSTRUMENTS.map((instrument) => (
                      <Badge
                        key={instrument}
                        variant={selectedInstruments.includes(instrument) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleInstrumentToggle(instrument)}
                      >
                        {instrument}
                        {selectedInstruments.includes(instrument) && <X className="w-3 h-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Nachricht (optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Persönliche Nachricht an den Künstler..."
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          {selectedArtist && (
            <Button onClick={handleInvite} disabled={loading}>
              {loading ? 'Wird versendet...' : 'Einladung senden'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BandInvitationModal;