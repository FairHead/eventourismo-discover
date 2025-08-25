import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Users, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const EventCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'concert' as const,
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    genres: [] as string[],
    band_id: '',
    website_url: '',
    ticket_url: '',
    lat: 0,
    lng: 0
  });

  const [bands, setBands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize map
    if (!mapContainer.current) return;

    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        
        mapboxgl.accessToken = data.token;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [10.4515, 51.1657], // Germany center
          zoom: 6
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add click handler to place pin
        map.current.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          
          // Remove existing marker
          if (marker.current) {
            marker.current.remove();
          }
          
          // Add new marker
          marker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          
          // Update form data
          setFormData(prev => ({ ...prev, lat, lng }));
        });

      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        toast({
          title: "Fehler",
          description: "Karte konnte nicht geladen werden",
          variant: "destructive"
        });
      }
    };

    fetchMapboxToken();

    return () => {
      map.current?.remove();
    };
  }, [toast]);

  useEffect(() => {
    // Fetch user's bands
    const fetchBands = async () => {
      if (!user) return;

      const { data: userBands, error } = await supabase
        .from('band_members')
        .select(`
          band_id,
          bands:band_id (
            id,
            name,
            avatar_url
          )
        `)
        .eq('artist_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching bands:', error);
        return;
      }

      const bandsList = userBands?.map(bm => bm.bands).filter(Boolean) || [];
      setBands(bandsList);
    };

    fetchBands();
  }, [user]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenreChange = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein",
        variant: "destructive"
      });
      return;
    }

    if (!formData.lat || !formData.lng) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Ort auf der Karte",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
      const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);

      const { error } = await supabase
        .from('events')
        .insert({
          title: formData.title,
          description: formData.description,
          event_type: formData.event_type,
          start_utc: startDateTime.toISOString(),
          end_utc: endDateTime.toISOString(),
          lat: formData.lat,
          lng: formData.lng,
          organizer_id: user.id,
          band_id: formData.band_id || null,
          genres: formData.genres,
          website_url: formData.website_url || null,
          ticket_url: formData.ticket_url || null,
          status: 'published'
        });

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Event wurde erfolgreich erstellt"
      });

      navigate('/');
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Fehler",
        description: "Event konnte nicht erstellt werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const eventTypes = [
    { value: 'concert', label: 'Konzert' },
    { value: 'festival', label: 'Festival' },
    { value: 'jam_session', label: 'Jam Session' },
    { value: 'open_mic', label: 'Open Mic' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'other', label: 'Sonstiges' }
  ];

  const genreOptions = [
    'Rock', 'Pop', 'Jazz', 'Blues', 'Classical', 'Electronic', 
    'Hip Hop', 'Reggae', 'Country', 'Folk', 'Metal', 'Punk'
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold">Event erstellen</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Abbrechen
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Map Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ort auswählen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              ref={mapContainer} 
              className="h-64 rounded-lg border"
              style={{ minHeight: '256px' }}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Klicken Sie auf die Karte, um den Event-Ort festzulegen
            </p>
            {formData.lat && formData.lng && (
              <p className="text-sm text-green-600 mt-1">
                Koordinaten: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Event Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Name des Events"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Beschreibung des Events"
                rows={3}
              />
            </div>

            <div>
              <Label>Event Type *</Label>
              <Select value={formData.event_type} onValueChange={(value) => handleInputChange('event_type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Date & Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Datum & Zeit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Datum *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="start_time">Start Zeit *</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="end_date">End Datum *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Zeit *</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange('end_time', e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Auftretende Band
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={formData.band_id} onValueChange={(value) => handleInputChange('band_id', value === 'none' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Band auswählen (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Band</SelectItem>
                {bands.map(band => (
                  <SelectItem key={band.id} value={band.id}>
                    {band.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Genres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Genres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {genreOptions.map(genre => (
                <Button
                  key={genre}
                  type="button"
                  variant={formData.genres.includes(genre) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleGenreChange(genre)}
                >
                  {genre}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle>Zusätzliche Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => handleInputChange('website_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="ticket_url">Ticket URL</Label>
              <Input
                id="ticket_url"
                type="url"
                value={formData.ticket_url}
                onChange={(e) => handleInputChange('ticket_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="sticky bottom-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 -mx-4 border-t">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !formData.title || !formData.start_date || !formData.start_time || !formData.end_date || !formData.end_time || !formData.lat || !formData.lng}
          >
            {loading ? 'Event wird erstellt...' : 'Event erstellen'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EventCreate;