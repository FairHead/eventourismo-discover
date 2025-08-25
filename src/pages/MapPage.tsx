import React, { useState } from 'react';
import MapView from '@/components/MapView';
import InfoPanel from '@/components/InfoPanel';

// Demo event data
const demoEventData = {
  '1': {
    id: '1',
    title: 'Berlin Jazz Night',
    subtitle: 'Jazz • Live Konzert',
    type: 'event' as const,
    status: 'live' as const,
    startTime: '20:00',
    endTime: '23:30',
    location: 'Friedrichshain, Berlin',
    genres: ['Jazz', 'Blues'],
    description: 'Ein unvergesslicher Abend mit den besten Jazz-Musikern der Stadt. Erleben Sie authentische Jazz-Sounds in einer intimen Atmosphäre mit erstklassigen Cocktails und einer lebendigen Community von Musikliebhabern.',
    images: ['/api/placeholder/400/300'],
    ticketUrl: 'https://example.com/tickets',
    websiteUrl: 'https://example.com',
    rating: 4.8,
    attendees: 127,
    isFavorite: false,
  },
  '2': {
    id: '2',
    title: 'Rock am Ring Preview',
    subtitle: 'Rock • Konzert',
    type: 'event' as const,
    status: 'upcoming' as const,
    startTime: 'Morgen 19:00',
    location: 'Kreuzberg, Berlin',
    genres: ['Rock', 'Metal'],
    description: 'Die heißesten Rock-Acts der Stadt präsentieren ihre neuesten Songs. Eine explosive Show mit kraftvoller Energie und unvergesslichen Momenten für alle Rock-Fans.',
    images: ['/api/placeholder/400/300'],
    rating: 4.5,
    attendees: 89,
    isFavorite: true,
  },
  '3': {
    id: '3',
    title: 'Tresor Club',
    subtitle: 'Electronic • Venue',
    type: 'venue' as const,
    status: 'upcoming' as const,
    startTime: '22:00',
    endTime: '06:00',
    location: 'Mitte, Berlin',
    genres: ['Electronic', 'Techno'],
    description: 'Berlins legendärer Techno-Tempel mit underground elektronischer Musik. Ein Ort, der Musikgeschichte geschrieben hat und weiterhin die besten DJs der Welt anzieht.',
    images: ['/api/placeholder/400/300'],
    ticketUrl: 'https://example.com/tresor',
    websiteUrl: 'https://tresor.de',
    rating: 4.9,
    attendees: 245,
    isFavorite: false,
  },
};

const MapPage: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const handlePinClick = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handlePanelClose = () => {
    setSelectedEventId(null);
  };

  const selectedEvent = selectedEventId ? demoEventData[selectedEventId as keyof typeof demoEventData] : undefined;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <MapView onPinClick={handlePinClick} />
      <InfoPanel 
        isOpen={!!selectedEventId}
        onClose={handlePanelClose}
        eventData={selectedEvent}
      />
    </div>
  );
};

export default MapPage;