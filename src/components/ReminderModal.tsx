import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, subHours, subMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bell, Trash2, Clock, MessageSquare } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  start_utc: string;
}

interface Reminder {
  id: string;
  event_id: string;
  reminder_time: string;
  message?: string;
  is_active: boolean;
}

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  existingReminder?: Reminder;
  onSuccess: () => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  event,
  existingReminder,
  onSuccess
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reminderType, setReminderType] = useState<string>('custom');
  const [customTime, setCustomTime] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && event) {
      if (existingReminder) {
        // Bearbeiten einer bestehenden Erinnerung
        const reminderDate = parseISO(existingReminder.reminder_time);
        const eventDate = parseISO(event.start_utc);
        
        // Bestimme den Typ basierend auf der Zeit
        const timeDiff = eventDate.getTime() - reminderDate.getTime();
        const hours = timeDiff / (1000 * 60 * 60);
        
        if (Math.abs(hours - 24) < 1) {
          setReminderType('24h');
        } else if (Math.abs(hours - 3) < 1) {
          setReminderType('3h');
        } else if (Math.abs(hours - 1) < 1) {
          setReminderType('1h');
        } else {
          setReminderType('custom');
          setCustomTime(format(reminderDate, "yyyy-MM-dd'T'HH:mm"));
        }
        
        setMessage(existingReminder.message || '');
      } else {
        // Neue Erinnerung
        setReminderType('24h');
        setMessage(`Erinnerung: ${event.title} beginnt bald!`);
        setCustomTime('');
      }
    }
  }, [isOpen, event, existingReminder]);

  const getReminderDateTime = (): Date | null => {
    if (!event) return null;
    
    const eventDate = parseISO(event.start_utc);
    
    switch (reminderType) {
      case '24h':
        return subHours(eventDate, 24);
      case '3h':
        return subHours(eventDate, 3);
      case '1h':
        return subHours(eventDate, 1);
      case '30m':
        return subMinutes(eventDate, 30);
      case 'custom':
        if (customTime) {
          return new Date(customTime);
        }
        return null;
      default:
        return null;
    }
  };

  const handleSave = async () => {
    if (!user || !event) return;
    
    const reminderDateTime = getReminderDateTime();
    if (!reminderDateTime) {
      toast({
        title: "Fehler",
        description: "Bitte wähle eine gültige Erinnerungszeit.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const reminderData = {
        user_id: user.id,
        event_id: event.id,
        reminder_time: reminderDateTime.toISOString(),
        message: message || `Erinnerung: ${event.title} beginnt bald!`,
        is_active: true,
      };

      if (existingReminder) {
        // Update bestehende Erinnerung
        const { error } = await supabase
          .from('reminders')
          .update(reminderData)
          .eq('id', existingReminder.id);

        if (error) throw error;

        toast({
          title: "Erinnerung aktualisiert",
          description: `Erinnerung für "${event.title}" wurde aktualisiert.`,
        });
      } else {
        // Neue Erinnerung erstellen
        const { error } = await supabase
          .from('reminders')
          .insert([reminderData]);

        if (error) throw error;

        toast({
          title: "Erinnerung gesetzt",
          description: `Du wirst am ${format(reminderDateTime, 'dd.MM.yyyy um HH:mm', { locale: de })} erinnert.`,
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast({
        title: "Fehler",
        description: "Erinnerung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReminder) return;

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', existingReminder.id);

      if (error) throw error;

      toast({
        title: "Erinnerung gelöscht",
        description: "Erinnerung wurde erfolgreich entfernt.",
      });

      onSuccess();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: "Fehler",
        description: "Erinnerung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const reminderDateTime = getReminderDateTime();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            {existingReminder ? 'Erinnerung bearbeiten' : 'Erinnerung setzen'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium">{event.title}</h4>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(event.start_utc), 'dd. MMMM yyyy, HH:mm', { locale: de })} Uhr
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderType" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Erinnerungszeit
            </Label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 Stunden vorher</SelectItem>
                <SelectItem value="3h">3 Stunden vorher</SelectItem>
                <SelectItem value="1h">1 Stunde vorher</SelectItem>
                <SelectItem value="30m">30 Minuten vorher</SelectItem>
                <SelectItem value="custom">Benutzerdefiniert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reminderType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customTime">Datum und Uhrzeit</Label>
              <Input
                id="customTime"
                type="datetime-local"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                max={format(parseISO(event.start_utc), "yyyy-MM-dd'T'HH:mm")}
              />
            </div>
          )}

          {reminderDateTime && (
            <div className="p-2 bg-primary/10 rounded text-sm">
              <strong>Erinnerung:</strong> {format(reminderDateTime, 'dd. MMMM yyyy, HH:mm', { locale: de })} Uhr
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Nachricht (optional)
            </Label>
            <Textarea
              id="message"
              placeholder="Benutzerdefinierte Erinnerungsnachricht..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            {existingReminder && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={loading}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
              </Button>
            )}
            <Button 
              onClick={handleSave}
              disabled={loading || !reminderDateTime}
              className="flex-1"
            >
              <Bell className="w-4 h-4 mr-2" />
              {existingReminder ? 'Aktualisieren' : 'Speichern'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderModal;