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
  Mail, 
  Phone, 
  MapPin, 
  Euro,
  Clock,
  Users,
  X,
  Plus
} from 'lucide-react';

interface ArtistProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProfile?: any;
}

const MUSIC_GENRES = [
  'Rock', 'Pop', 'Jazz', 'Classical', 'Electronic', 'Hip-Hop', 'R&B', 'Country',
  'Folk', 'Reggae', 'Punk', 'Metal', 'Indie', 'Alternative', 'Blues', 'Funk',
  'Soul', 'Latin', 'World', 'Experimental'
];

const INSTRUMENTS = [
  'Gesang', 'Gitarre', 'Bass', 'Schlagzeug', 'Klavier', 'Keyboard', 'Violine',
  'Saxophon', 'Trompete', 'Flöte', 'Cello', 'Kontrabass', 'Harmonika',
  'DJ-Equipment', 'Synthesizer', 'Ukulele', 'Banjo', 'Mandoline'
];

const PRICE_RANGES = [
  'Unter 500€', '500€ - 1.000€', '1.000€ - 2.500€', '2.500€ - 5.000€', 'Über 5.000€'
];

const ArtistProfileModal: React.FC<ArtistProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingProfile
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [stageName, setStageName] = useState('');
  const [bio, setBio] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [performanceRadius, setPerformanceRadius] = useState('50');
  const [availableForBookings, setAvailableForBookings] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  
  // Social links
  const [instagramUrl, setInstagramUrl] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  
  // Arrays
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState('');
  const [customInstrument, setCustomInstrument] = useState('');

  // Load existing profile data
  useEffect(() => {
    if (existingProfile) {
      setStageName(existingProfile.stage_name || '');
      setBio(existingProfile.bio || '');
      setDescription(existingProfile.description || '');
      setCity(existingProfile.city || '');
      setExperienceYears(existingProfile.experience_years?.toString() || '');
      setPriceRange(existingProfile.price_range || '');
      setPerformanceRadius(existingProfile.performance_radius_km?.toString() || '50');
      setAvailableForBookings(existingProfile.available_for_bookings ?? true);
      setContactEmail(existingProfile.contact_email || '');
      setPhoneNumber(existingProfile.phone_number || '');
      setWebsiteUrl(existingProfile.website_url || '');
      setSelectedGenres(existingProfile.genres || []);
      setSelectedInstruments(existingProfile.instruments || []);
      
      // Load social links
      const socialLinks = existingProfile.social_links || {};
      setInstagramUrl(socialLinks.instagram || '');
      setSpotifyUrl(socialLinks.spotify || '');
      setYoutubeUrl(socialLinks.youtube || '');
      setSoundcloudUrl(socialLinks.soundcloud || '');
    }
  }, [existingProfile]);

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleInstrumentToggle = (instrument: string) => {
    setSelectedInstruments(prev => 
      prev.includes(instrument) 
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
    );
  };

  const addCustomGenre = () => {
    if (customGenre.trim() && !selectedGenres.includes(customGenre.trim())) {
      setSelectedGenres(prev => [...prev, customGenre.trim()]);
      setCustomGenre('');
    }
  };

  const addCustomInstrument = () => {
    if (customInstrument.trim() && !selectedInstruments.includes(customInstrument.trim())) {
      setSelectedInstruments(prev => [...prev, customInstrument.trim()]);
      setCustomInstrument('');
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!stageName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Künstlernamen ein.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Prepare social links
      const socialLinks = {
        instagram: instagramUrl || null,
        spotify: spotifyUrl || null,
        youtube: youtubeUrl || null,
        soundcloud: soundcloudUrl || null
      };

      // Prepare data
      const profileData = {
        user_id: user.id,
        stage_name: stageName.trim(),
        bio: bio.trim() || null,
        description: description.trim() || null,
        city: city.trim() || null,
        experience_years: experienceYears ? parseInt(experienceYears) : null,
        price_range: priceRange || null,
        performance_radius_km: parseInt(performanceRadius),
        available_for_bookings: availableForBookings,
        contact_email: contactEmail.trim() || null,
        phone_number: phoneNumber.trim() || null,
        website_url: websiteUrl.trim() || null,
        genres: selectedGenres,
        instruments: selectedInstruments,
        social_links: socialLinks
      };

      // Upsert artist profile
      const { error: profileError } = await supabase
        .from('artist_profiles')
        .upsert(profileData, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      // Update user role to artist
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'artist' })
        .eq('id', user.id);

      if (roleError) throw roleError;

      toast({
        title: "Künstler-Profil erstellt",
        description: "Ihr Künstler-Profil wurde erfolgreich erstellt!",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving artist profile:', error);
      toast({
        title: "Fehler",
        description: "Das Profil konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            {existingProfile ? 'Künstler-Profil bearbeiten' : 'Als Künstler anmelden'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Grundinformationen */}
          <div className="space-y-4">
            <h3 className="font-semibold">Grundinformationen</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stageName">Künstlername *</Label>
                <Input
                  id="stageName"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="Ihr Bühnename"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Stadt</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ihre Stadt"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Kurze Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Eine kurze Beschreibung Ihrer Musik..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detaillierte Beschreibung</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ausführliche Beschreibung Ihres Stils, Ihrer Erfahrung und was Sie einzigartig macht..."
                rows={4}
              />
            </div>
          </div>

          {/* Genres */}
          <div className="space-y-4">
            <h3 className="font-semibold">Genres</h3>
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

          {/* Instrumente */}
          <div className="space-y-4">
            <h3 className="font-semibold">Instrumente</h3>
            <div className="flex flex-wrap gap-2">
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
            <div className="flex gap-2">
              <Input
                value={customInstrument}
                onChange={(e) => setCustomInstrument(e.target.value)}
                placeholder="Eigenes Instrument hinzufügen"
                onKeyPress={(e) => e.key === 'Enter' && addCustomInstrument()}
              />
              <Button size="sm" onClick={addCustomInstrument}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Erfahrung & Preise */}
          <div className="space-y-4">
            <h3 className="font-semibold">Erfahrung & Preise</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="experience">Jahre Erfahrung</Label>
                <Input
                  id="experience"
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="Anzahl Jahre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceRange">Preisklasse pro Auftritt</Label>
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full p-2 border border-input rounded-md bg-background"
                >
                  <option value="">Bitte wählen</option>
                  {PRICE_RANGES.map((range) => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius">Auftritte im Umkreis (km)</Label>
              <Input
                id="radius"
                type="number"
                value={performanceRadius}
                onChange={(e) => setPerformanceRadius(e.target.value)}
                placeholder="50"
              />
            </div>
          </div>

          {/* Kontakt */}
          <div className="space-y-4">
            <h3 className="font-semibold">Kontaktdaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">E-Mail</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="kontakt@beispiel.de"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Telefon</Label>
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://ihre-website.de"
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
                  placeholder="https://instagram.com/ihrusername"
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
                <div className="w-4 h-4 bg-red-500 rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-bold">Y</span>
                </div>
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@ihrusername"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <Input
                  value={soundcloudUrl}
                  onChange={(e) => setSoundcloudUrl(e.target.value)}
                  placeholder="https://soundcloud.com/ihrusername"
                />
              </div>
            </div>
          </div>

          {/* Verfügbarkeit */}
          <div className="space-y-4">
            <h3 className="font-semibold">Verfügbarkeit</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="available"
                checked={availableForBookings}
                onChange={(e) => setAvailableForBookings(e.target.checked)}
              />
              <Label htmlFor="available">Für Buchungen verfügbar</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Wird gespeichert...' : 'Profil speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ArtistProfileModal;