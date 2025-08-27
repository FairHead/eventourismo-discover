import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onEventUpdated?: () => void;
}

const EventEditModal: React.FC<EventEditModalProps> = ({ 
  isOpen, 
  onClose, 
  eventId,
  onEventUpdated 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'concert' | 'street' | 'theater' | 'club' | 'other'>('concert');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [address, setAddress] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [newGenre, setNewGenre] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(false);

  const { toast } = useToast();

  const availableGenres = [
    'Rock', 'Pop', 'Jazz', 'Classical', 'Electronic', 'Hip-Hop', 'Country', 
    'Folk', 'Blues', 'Reggae', 'Metal', 'Punk', 'Indie', 'Alternative'
  ];

  // Load event data when modal opens
  useEffect(() => {
    if (isOpen && eventId) {
      loadEventData();
    }
  }, [isOpen, eventId]);

  const loadEventData = async () => {
    setLoadingEvent(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: 'Event konnte nicht geladen werden.',
        });
        return;
      }

      if (data) {
        setTitle(data.title || '');
        setDescription(data.description || '');
        
        // Ensure event_type is one of the valid options
        const validEventTypes: Array<'concert' | 'street' | 'theater' | 'club' | 'other'> = ['concert', 'street', 'theater', 'club', 'other'];
        const eventType = validEventTypes.includes(data.event_type as any) ? (data.event_type as 'concert' | 'street' | 'theater' | 'club' | 'other') : 'other';
        setEventType(eventType);
        
        const startDateTime = new Date(data.start_utc);
        const endDateTime = new Date(data.end_utc);
        
        setStartDate(startDateTime);
        setEndDate(endDateTime);
        setStartTime(format(startDateTime, 'HH:mm'));
        setEndTime(format(endDateTime, 'HH:mm'));
        
        setGenres(data.genres || []);
        setTicketUrl(data.ticket_url || '');
        setWebsiteUrl(data.website_url || '');
      }
    } catch (error) {
      console.error('Error loading event:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Ein Fehler ist beim Laden des Events aufgetreten.',
      });
    } finally {
      setLoadingEvent(false);
    }
  };

  const addGenre = (genre: string) => {
    if (genre && !genres.includes(genre)) {
      setGenres([...genres, genre]);
      setNewGenre('');
    }
  };

  const removeGenre = (genreToRemove: string) => {
    setGenres(genres.filter(g => g !== genreToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate || !startTime || !endTime) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Bitte alle Pflichtfelder ausfüllen.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Combine date and time
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startUtc = new Date(startDate);
      startUtc.setHours(startHours, startMinutes, 0, 0);
      
      const endUtc = new Date(endDate);
      endUtc.setHours(endHours, endMinutes, 0, 0);

      const { error } = await supabase
        .from('events')
        .update({
          title,
          description,
          event_type: eventType,
          start_utc: startUtc.toISOString(),
          end_utc: endUtc.toISOString(),
          genres,
          ticket_url: ticketUrl || null,
          website_url: websiteUrl || null,
        })
        .eq('id', eventId);

      if (error) {
        console.error('Error updating event:', error);
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: 'Event konnte nicht aktualisiert werden.',
        });
        return;
      }

      toast({
        title: 'Erfolg',
        description: 'Event wurde erfolgreich aktualisiert.',
      });
      
      onEventUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Event wird geladen...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Event bearbeiten</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event Titel"
              required
            />
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label>Event Typ</Label>
          <Select value={eventType} onValueChange={(value) => setEventType(value as 'concert' | 'street' | 'theater' | 'club' | 'other')}>
            <SelectTrigger>
              <SelectValue placeholder="Event Typ auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concert">Konzert</SelectItem>
              <SelectItem value="street">Straßenauftritt</SelectItem>
              <SelectItem value="theater">Theater</SelectItem>
              <SelectItem value="club">Club</SelectItem>
              <SelectItem value="other">Sonstiges</SelectItem>
            </SelectContent>
          </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startdatum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd.MM.yyyy", { locale: de }) : "Datum auswählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Startzeit *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Enddatum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd.MM.yyyy", { locale: de }) : "Datum auswählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">Endzeit *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Genres */}
          <div className="space-y-2">
            <Label>Genres</Label>
            <div className="flex gap-2 mb-2">
              <Select value={newGenre} onValueChange={setNewGenre}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Genre auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {availableGenres
                    .filter(genre => !genres.includes(genre))
                    .map(genre => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                onClick={() => addGenre(newGenre)}
                disabled={!newGenre || genres.includes(newGenre)}
              >
                Hinzufügen
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {genres.map(genre => (
                <Badge key={genre} variant="secondary" className="flex items-center gap-1">
                  {genre}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => removeGenre(genre)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event Beschreibung..."
              rows={4}
            />
          </div>

          {/* URLs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticketUrl">Ticket URL</Label>
              <Input
                id="ticketUrl"
                type="url"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://tickets.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventEditModal;