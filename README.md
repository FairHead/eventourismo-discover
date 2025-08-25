# Eventourismo 🎵

Eine cross-platform Mobile-App für Live-Musik und Kulturveranstaltungen mit interaktiver Stadtkarte.

## 🌟 Features

- **Interaktive Mapbox-Karte** mit Event- und Venue-Pins
- **Slide-Panel Interface** für Event-Details
- **Multi-Role System** (Nutzer, Künstler, Veranstalter, Venue-Admin)
- **Live-Event Tracking** mit Status-Badges
- **Filter & Suche** nach Genre, Art, Zeit und Ort
- **Cross-Platform** für iOS & Android via Capacitor

## 🚀 Setup

### 1. Projekt klonen und installieren
```bash
git clone <repository-url>
cd eventourismo
npm install
```

### 2. Mapbox Token konfigurieren
1. Erstellen Sie einen kostenlosen Account bei [Mapbox](https://mapbox.com)
2. Kopieren Sie Ihren Public Token
3. Starten Sie die App und geben Sie den Token ein, wenn aufgefordert
   - Oder setzen Sie ihn direkt: `localStorage.setItem('mapbox-token', 'YOUR_TOKEN')`

### 3. Supabase Backend (empfohlen)
Für vollständige Backend-Funktionalität:
1. Klicken Sie auf den grünen **Supabase**-Button oben rechts in Lovable
2. Verbinden Sie Ihr Supabase-Projekt
3. Das Schema wird automatisch erstellt (siehe `Database Schema` unten)

### 4. Mobile Development
Für iOS/Android Apps:
```bash
# Capacitor initialisieren (bereits konfiguriert)
npx cap init

# Plattformen hinzufügen
npx cap add ios
npx cap add android

# Build und Sync
npm run build
npx cap sync

# Auf Emulator/Device starten
npx cap run android
npx cap run ios  # Benötigt macOS + Xcode
```

## 📱 App-Struktur

### Navigation
- **Karte** (`/`) - Hauptansicht mit interaktiver Karte
- **Suchen** (`/search`) - Event- und Venue-Suche
- **Erstellen** (`/create`) - Event-Management (Künstler/Veranstalter)
- **Favoriten** (`/favorites`) - Gespeicherte Events/Venues
- **Profil** (`/profile`) - Nutzereinstellungen und Konto

### Hauptkomponenten
- `MapView` - Mapbox-Karte mit Pins und Clustering
- `InfoPanel` - Slide-Panel für Event-Details
- `BottomNavigation` - Mobile Navigation
- Enhanced UI Components mit Premium-Design-System

## 🎨 Design-System

### Farbschema
- **Primary**: Electric Purple (`271 91% 65%`)
- **Secondary**: Deep Blue (`217 91% 20%`)
- **Accent**: Vibrant Orange (`25 95% 60%`)
- **Event Status**: Live (Green), Upcoming (Yellow), Past (Gray)
- **Genre Colors**: Rock (Red), Electronic (Purple), Jazz (Yellow), etc.

### Gradients & Effects
- `bg-gradient-primary` - Purple to Orange
- `shadow-glow` - Primary color glow effect
- Smooth animations mit `active:scale-95`

## 🗄️ Database Schema (Supabase)

### Core Tables
```sql
-- Users mit Rollen
users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  display_name text,
  role user_role DEFAULT 'user', -- user|artist|organizer|venue_admin|admin
  preferred_genres text[],
  created_at timestamptz,
  updated_at timestamptz
);

-- Künstler-Profile
artist_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  bio text,
  links jsonb[], -- [{type, url, label}]
  avatar_url text
);

-- Veranstaltungsorte
venues (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  address text,
  lat numeric,
  lng numeric,
  website text,
  phone text,
  description text,
  hero_image_url text,
  opening_hours jsonb,
  socials jsonb,
  created_by uuid REFERENCES users(id)
);

-- Events
events (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_type event_type, -- street|concert|theater|club|other
  genres text[],
  start_utc timestamptz,
  end_utc timestamptz,
  venue_id uuid REFERENCES venues(id),
  organizer_id uuid REFERENCES users(id),
  lat numeric,
  lng numeric,
  ticket_url text,
  images text[],
  status event_status DEFAULT 'draft', -- draft|published|cancelled
  recurrence_rule text
);

-- Bewertungen & Favoriten
ratings (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  target_type rating_target, -- event|venue
  target_id uuid,
  stars int CHECK (stars >= 1 AND stars <= 5),
  comment text
);

favorites (
  user_id uuid REFERENCES users(id),
  target_type rating_target,
  target_id uuid,
  PRIMARY KEY (user_id, target_type, target_id)
);
```

### Indizes & Performance
```sql
-- Geo-Indizes für Karten-Queries
CREATE INDEX events_location_idx ON events USING GIST (
  ll_to_earth(lat, lng)
);

-- Zeit-basierte Indizes
CREATE INDEX events_time_idx ON events (start_utc, status);

-- Genre-Suche
CREATE INDEX events_genres_idx ON events USING GIN (genres);
```

## 🔧 Backend Functions (Supabase Edge Functions)

### BBox Queries
```javascript
// get_events_in_bbox(min_lng, min_lat, max_lng, max_lat, filters)
// Lädt Events im aktuellen Kartenausschnitt
// Unterstützt Filter: genres, event_types, time_range, search_query
```

### Event Management
```javascript
// create_event(event_data) - Neues Event erstellen
// update_event(event_id, changes) - Event bearbeiten  
// delete_event(event_id) - Event löschen
// toggle_favorite(target_type, target_id) - Favorit umschalten
```

## 🔐 Sicherheit & RLS

### Row Level Security Policies
```sql
-- Events: Nur published Events für normale Nutzer
CREATE POLICY "Users can view published events" ON events
  FOR SELECT USING (status = 'published' OR organizer_id = auth.uid());

-- Eigene Events bearbeiten
CREATE POLICY "Users can edit own events" ON events
  FOR UPDATE USING (organizer_id = auth.uid());

-- Favorites: Nur eigene
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (user_id = auth.uid());
```

## 📊 Demo-Daten

Die App startet mit Demo-Events in Berlin:
- Jazz Night (Live)
- Rock Concert (Upcoming) 
- Tresor Club (Venue)

## 🌍 Lokalisierung

- Deutsch/Englisch Support
- Lokale Zeitformate (24h)
- Europäische Zahlenformate
- Mobile-optimierte UX

## 📈 Nächste Schritte

1. **Supabase Backend** für Authentication & Daten
2. **Push-Benachrichtigungen** via Capacitor
3. **Event-Erstellung** UI für Künstler/Veranstalter
4. **Erweiterte Filter** und Suche
5. **Offline-Support** mit lokaler Datenspeicherung
6. **Social Features** (Kommentare, Bewertungen)

---

**Tech Stack**: React + TypeScript + Tailwind CSS + Mapbox + Supabase + Capacitor

Für weitere Informationen zur Supabase-Integration: [Supabase Docs](https://docs.lovable.dev/integrations/supabase/)