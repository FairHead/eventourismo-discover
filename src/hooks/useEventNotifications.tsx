import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EventNotification {
  id: string;
  title: string;
  start_utc: string;
  type: '24h' | '3h';
}

interface NotificationSettings {
  enabled: boolean;
  notify24h: boolean;
  notify3h: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  notify24h: true,
  notify3h: true,
};

export const useEventNotifications = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  // Load notification settings from localStorage
  useEffect(() => {
    if (!user) return;
    
    const savedSettings = localStorage.getItem(`eventNotifications_${user.id}`);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    }

    // Load shown notifications to avoid duplicates
    const savedShown = localStorage.getItem(`shownNotifications_${user.id}`);
    if (savedShown) {
      try {
        setShownNotifications(new Set(JSON.parse(savedShown)));
      } catch (error) {
        console.error('Error loading shown notifications:', error);
      }
    }
  }, [user]);

  // Save settings to localStorage
  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    if (!user) return;
    
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem(`eventNotifications_${user.id}`, JSON.stringify(updatedSettings));
  };

  // Check for upcoming favorite events and show notifications
  const checkForNotifications = async () => {
    if (!user || !settings.enabled) return;

    try {
      // Get user's favorite events
      const { data: favorites, error: favError } = await supabase
        .from('favorites')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'event');

      if (favError || !favorites || favorites.length === 0) return;

      const eventIds = favorites.map(fav => fav.target_id);

      // Get upcoming events
      const now = new Date();
      const next25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, title, start_utc')
        .in('id', eventIds)
        .eq('status', 'published')
        .gte('start_utc', now.toISOString())
        .lte('start_utc', next25Hours.toISOString());

      if (eventError || !events) return;

      // Check each event for notification timing
      events.forEach((event) => {
        const eventStart = new Date(event.start_utc);
        const minutesToStart = Math.floor((eventStart.getTime() - now.getTime()) / (1000 * 60));
        
        const notificationKey24h = `${event.id}_24h`;
        const notificationKey3h = `${event.id}_3h`;

        // 24 hour notification (between 23.5 and 24.5 hours)
        if (settings.notify24h && 
            minutesToStart >= 1410 && minutesToStart <= 1470 && 
            !shownNotifications.has(notificationKey24h)) {
          
          showNotification({
            id: event.id,
            title: event.title,
            start_utc: event.start_utc,
            type: '24h'
          });
          
          markNotificationShown(notificationKey24h);
        }

        // 3 hour notification (between 2.5 and 3.5 hours)
        if (settings.notify3h && 
            minutesToStart >= 150 && minutesToStart <= 210 && 
            !shownNotifications.has(notificationKey3h)) {
          
          showNotification({
            id: event.id,
            title: event.title,
            start_utc: event.start_utc,
            type: '3h'
          });
          
          markNotificationShown(notificationKey3h);
        }
      });
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  };

  // Show notification toast
  const showNotification = (notification: EventNotification) => {
    const timeText = notification.type === '24h' ? 'morgen' : 'in 3 Stunden';
    const eventTime = new Date(notification.start_utc).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    toast.info(`🎵 Event Erinnerung`, {
      description: `"${notification.title}" beginnt ${timeText} um ${eventTime}`,
      duration: 8000,
      action: {
        label: 'Zur Karte',
        onClick: () => {
          // Navigate to event on map
          sessionStorage.setItem('focusEventId', notification.id);
          window.location.href = '/';
        },
      },
    });
  };

  // Mark notification as shown
  const markNotificationShown = (notificationKey: string) => {
    if (!user) return;
    
    const newShown = new Set(shownNotifications);
    newShown.add(notificationKey);
    setShownNotifications(newShown);
    
    // Save to localStorage
    localStorage.setItem(`shownNotifications_${user.id}`, JSON.stringify([...newShown]));
  };

  // Clean up old shown notifications (older than 7 days)
  const cleanupOldNotifications = () => {
    if (!user) return;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // This is a simple cleanup - in a real app you might want to track timestamps
    // For now, we'll just clear all shown notifications older than a week
    const newShown = new Set<string>();
    setShownNotifications(newShown);
    localStorage.setItem(`shownNotifications_${user.id}`, JSON.stringify([]));
  };

  // Check for notifications every minute
  useEffect(() => {
    if (!user || !settings.enabled) return;

    // Initial check
    checkForNotifications();

    // Set up interval to check every minute
    const interval = setInterval(checkForNotifications, 60 * 1000);

    // Cleanup old notifications daily
    const cleanupInterval = setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(cleanupInterval);
    };
  }, [user, settings]);

  return {
    settings,
    updateSettings,
    checkForNotifications,
  };
};