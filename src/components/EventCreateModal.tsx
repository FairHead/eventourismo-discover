import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Users, Tag, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
  initialMapPosition?: {center: [number, number], zoom: number} | null;
}

const EventCreateModal: React.FC<EventCreateModalProps> = ({ isOpen, onClose, onEventCreated, initialMapPosition }) => {
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
    lng: 0,
    address: ''
  });

  const [bands, setBands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const initializeMap = async () => {
      // Wait for container to be available and have dimensions
      if (!mapContainer.current) {
        console.log('Map container not ready');
        return;
      }

      const containerRect = mapContainer.current.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) {
        console.log('Map container has no dimensions:', containerRect);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        
        if (!mounted) return;
        
        mapboxgl.accessToken = data.token;
        console.log('Mapbox token set, initializing map...');

        // Get user's current location
        const getCurrentPosition = (): Promise<GeolocationPosition> => {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation is not supported'));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            });
          });
        };

        let initialCenter: [number, number] = [10.4515, 51.1657]; // Germany center
        let initialZoom = 6;

        // Use provided map position if available
        if (initialMapPosition) {
          initialCenter = initialMapPosition.center;
          initialZoom = initialMapPosition.zoom;
          
          // Update form data with center position
          setFormData(prev => ({ 
            ...prev, 
            lat: initialMapPosition.center[1], 
            lng: initialMapPosition.center[0] 
          }));
        } else {
          // Try to get user's current location only if no initial position provided
          try {
            const position = await getCurrentPosition();
            initialCenter = [position.coords.longitude, position.coords.latitude];
            initialZoom = 12;
            
            // Update form data with current location
            setFormData(prev => ({ 
              ...prev, 
              lat: position.coords.latitude, 
              lng: position.coords.longitude 
            }));
          } catch (geoError) {
            console.log('Could not get current location:', geoError);
            // Continue with default location
          }
        }

        if (!mounted) return;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: initialCenter,
          zoom: initialZoom
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add geocoder for location search
        const geocoder = new MapboxGeocoder({
          accessToken: data.token,
          mapboxgl: mapboxgl,
          placeholder: 'Nach Orten suchen...',
          countries: 'de'
        });
        
        map.current.addControl(geocoder, 'top-left');

        // Handle geocoder result - store both coordinates and address
        geocoder.on('result', (e) => {
          const { center, place_name } = e.result;
          const [lng, lat] = center;
          
          // Remove existing marker
          if (marker.current) {
            marker.current.remove();
          }
          
          // Add new marker
          marker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          
          // Update form data with coordinates and address
          setFormData(prev => ({ ...prev, lat, lng, address: place_name }));
        });

        // Add initial marker if we have coordinates
        if (initialMapPosition || initialZoom === 12) {
          marker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat(initialCenter)
            .addTo(map.current);
        }

        // Add click handler to place pin and get address via reverse geocoding
        map.current.on('click', async (e) => {
          const { lng, lat } = e.lngLat;
          
          // Remove existing marker
          if (marker.current) {
            marker.current.remove();
          }
          
          // Add new marker
          marker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          
          // Update coordinates immediately
          setFormData(prev => ({ ...prev, lat, lng }));
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${data.token}&types=address,poi&country=de&limit=1`
            );
            const geoData = await response.json();
            
            if (geoData.features && geoData.features.length > 0) {
              const address = geoData.features[0].place_name;
              setFormData(prev => ({ ...prev, address }));
            }
          } catch (error) {
            console.error('Reverse geocoding failed:', error);
            // Don't show error to user, coordinates are still valid
          }
        });

        // Ensure map resizes properly when modal is opened
        map.current.on('load', () => {
          if (map.current) {
            setTimeout(() => {
              map.current?.resize();
            }, 100);
          }
        });

      } catch (error) {
        console.error('Error initializing map:', error);
        if (mounted) {
          toast({
            title: "Fehler",
            description: "Karte konnte nicht geladen werden",
            variant: "destructive"
          });
        }
      }
    };

    // Try multiple times to initialize the map
    let attempts = 0;
    const maxAttempts = 5;
    
    const tryInitializeMap = () => {
      attempts++;
      initializeMap().then(() => {
        // Map initialized successfully
      }).catch((error) => {
        console.log(`Map initialization attempt ${attempts} failed:`, error);
        if (attempts < maxAttempts) {
          setTimeout(tryInitializeMap, 300);
        }
      });
    };

    const timer = setTimeout(tryInitializeMap, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
    };
  }, [isOpen, toast, initialMapPosition]);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [user, isOpen]);

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

  const handleClose = () => {
    // Reset form
    setFormData({
      title: '',
      description: '',
      event_type: 'concert',
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      genres: [],
      band_id: '',
      website_url: '',
      ticket_url: '',
      lat: 0,
      lng: 0,
      address: ''
    });
    onClose();
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

      handleClose();
      onEventCreated?.();
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
    { value: 'street', label: 'Straßenmusik' },
    { value: 'theater', label: 'Theater' },
    { value: 'club', label: 'Club' },
    { value: 'other', label: 'Sonstiges' }
  ];

  const genreOptions = [
    'Rock', 'Pop', 'Jazz', 'Blues', 'Classical', 'Electronic', 
    'Hip Hop', 'Reggae', 'Country', 'Folk', 'Metal', 'Punk'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Event erstellen
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full h-64 rounded-lg border"
                style={{ minHeight: '256px', minWidth: '100%' }}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Verwenden Sie die Suchfunktion (oben links) oder klicken Sie auf die Karte, um den Event-Ort festzulegen. 
                Die Karte zeigt automatisch Ihren aktuellen Standort an.
              </p>
              {formData.lat && formData.lng && (
                <div className="space-y-1 mt-2">
                  <p className="text-sm text-green-600">
                    Koordinaten: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
                  </p>
                  {formData.address && (
                    <p className="text-sm text-blue-600">
                      Adresse: {formData.address}
                    </p>
                  )}
                </div>
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
          <div className="flex gap-4 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1" 
              onClick={handleClose}
            >
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={loading || !formData.title || !formData.start_date || !formData.start_time || !formData.end_date || !formData.end_time || !formData.lat || !formData.lng}
            >
              {loading ? 'Event wird erstellt...' : 'Event erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventCreateModal;