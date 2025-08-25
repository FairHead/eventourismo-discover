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
  Music, 
  Instagram, 
  Globe, 
  Users,
  X,
  Plus,
  Youtube
} from 'lucide-react';

interface BandProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingBand?: any;
}

const MUSIC_GENRES = [
  'Rock', 'Pop', 'Jazz', 'Classical', 'Electronic', 'Hip-Hop', 'R&B', 'Country',
  'Folk', 'Reggae', 'Punk', 'Metal', 'Indie', 'Alternative', 'Blues', 'Funk',
  'Soul', 'Latin', 'World', 'Experimental'
];

const BandProfileModal: React.FC<BandProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingBand
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [bandName, setBandName] = useState('');
  const [bio, setBio] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [formationYear, setFormationYear] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  
  // Social links
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  
  // Arrays
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState('');

  // Load existing band data
  useEffect(() => {
    if (existingBand) {
      setBandName(existingBand.name || '');
      setBio(existingBand.bio || '');
      setDescription(existingBand.description || '');
      setCity(existingBand.city || '');
      setCountry(existingBand.country || 'Deutschland');
      setFormationYear(existingBand.formation_year?.toString() || '');
      setWebsiteUrl(existingBand.website_url || '');
      setSelectedGenres(existingBand.genres || []);
      
      // Load social links
      const socialLinks = existingBand.social_links || {};
      setInstagramUrl(socialLinks.instagram || '');
      setYoutubeUrl(socialLinks.youtube || '');
      setSpotifyUrl(socialLinks.spotify || '');
      setSoundcloudUrl(socialLinks.soundcloud || '');
    }
  }, [existingBand]);

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const addCustomGenre = () => {
    if (customGenre.trim() && !selectedGenres.includes(customGenre.trim())) {
      setSelectedGenres(prev => [...prev, customGenre.trim()]);
      setCustomGenre('');
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!bandName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Bandnamen ein.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Prepare social links
      const socialLinks = {
        instagram: instagramUrl || null,
        youtube: youtubeUrl || null,
        spotify: spotifyUrl || null,
        soundcloud: soundcloudUrl || null
      };

      // Prepare data
      const bandData = {
        name: bandName.trim(),
        bio: bio.trim() || null,
        description: description.trim() || null,
        city: city.trim() || null,
        country: country || 'Deutschland',
        formation_year: formationYear ? parseInt(formationYear) : null,
        website_url: websiteUrl.trim() || null,
        genres: selectedGenres,
        social_links: socialLinks,
        created_by: user.id,
        active: true
      };

      let bandId;
      if (existingBand) {
        // Update existing band
        const { error: updateError } = await supabase
          .from('bands')
          .update(bandData)
          .eq('id', existingBand.id);

        if (updateError) throw updateError;
        bandId = existingBand.id;
      } else {
        // Create new band
        const { data: newBand, error: createError } = await supabase
          .from('bands')
          .insert(bandData)
          .select()
          .single();

        if (createError) throw createError;
        bandId = newBand.id;

        // Add creator as admin member
        const { error: memberError } = await supabase
          .from('band_members')
          .insert({
            band_id: bandId,
            artist_id: user.id,
            role: 'admin',
            is_active: true
          });

        if (memberError) throw memberError;
      }

      toast({
        title: existingBand ? "Band aktualisiert" : "Band erstellt",
        description: existingBand 
          ? "Ihr Band-Profil wurde erfolgreich aktualisiert!" 
          : "Ihr Band-Profil wurde erfolgreich erstellt!",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving band profile:', error);
      toast({
        title: "Fehler",
        description: "Das Band-Profil konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {existingBand ? 'Band-Profil bearbeiten' : 'Band gründen'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Grundinformationen */}
          <div className="space-y-4">
            <h3 className="font-semibold">Grundinformationen</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bandName">Bandname *</Label>
                <Input
                  id="bandName"
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder="Name Ihrer Band"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formationYear">Gründungsjahr</Label>
                <Input
                  id="formationYear"
                  type="number"
                  value={formationYear}
                  onChange={(e) => setFormationYear(e.target.value)}
                  placeholder="z.B. 2020"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Stadt</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Heimatstadt der Band"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Deutschland"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Kurze Beschreibung</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Eine kurze Beschreibung Ihrer Band..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detaillierte Beschreibung</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ausführliche Beschreibung der Band, Geschichte, Stil..."
                rows={4}
              />
            </div>
          </div>

          {/* Genres */}
          <div className="space-y-4">
            <h3 className="font-semibold">Musikrichtungen</h3>
            <div className="flex flex-wrap gap-2">
              {MUSIC_GENRES.map((genre) => (
                <Badge
                  key={genre}
                  variant={selectedGenres.includes(genre) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleGenreToggle(genre)}
                >
                  {genre}
                  {selectedGenres.includes(genre) && <X className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                placeholder="Eigenes Genre hinzufügen"
                onKeyPress={(e) => e.key === 'Enter' && addCustomGenre()}
              />
              <Button size="sm" onClick={addCustomGenre}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Website */}
          <div className="space-y-4">
            <h3 className="font-semibold">Website</h3>
            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://ihre-band-website.de"
              />
            </div>
          </div>

          {/* Social Media */}
          <div className="space-y-4">
            <h3 className="font-semibold">Social Media & Plattformen</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                <Input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/ihreband"
                />
              </div>
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@ihreband"
                />
              </div>
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-green-500" />
                <Input
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/artist/..."
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <Input
                  value={soundcloudUrl}
                  onChange={(e) => setSoundcloudUrl(e.target.value)}
                  placeholder="https://soundcloud.com/ihreband"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Wird gespeichert...' : (existingBand ? 'Aktualisieren' : 'Band gründen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BandProfileModal;