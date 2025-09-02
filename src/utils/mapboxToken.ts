import { supabase } from '@/integrations/supabase/client';

// Zentrale Mapbox Token Verwaltung mit Caching
class MapboxTokenManager {
  private token: string | null = null;
  private tokenPromise: Promise<string> | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 Minuten Cache

  async getToken(): Promise<string> {
    const now = Date.now();
    
    // Verwende gecachtes Token wenn verfügbar und nicht abgelaufen
    if (this.token && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.token;
    }

    // Verwende laufende Anfrage falls vorhanden
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    // Neue Token-Anfrage starten
    this.tokenPromise = this.fetchToken();
    
    try {
      this.token = await this.tokenPromise;
      this.lastFetch = now;
      return this.token;
    } finally {
      this.tokenPromise = null;
    }
  }

  private async fetchToken(): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) {
        console.error('Mapbox token fetch error:', error);
        throw new Error(`Mapbox Token konnte nicht geladen werden: ${error.message}`);
      }
      
      if (!data?.token) {
        throw new Error('Mapbox Token ist leer oder nicht konfiguriert');
      }
      
      console.log('Mapbox token successfully fetched and cached');
      return data.token;
    } catch (error) {
      console.error('Error fetching Mapbox token:', error);
      throw error;
    }
  }

  // Token aus Cache entfernen (für Fehlerbehandlung)
  clearCache(): void {
    this.token = null;
    this.lastFetch = 0;
    this.tokenPromise = null;
  }

  // Token direkt setzen (für Tests oder externe Quellen)
  setToken(token: string): void {
    this.token = token;
    this.lastFetch = Date.now();
  }
}

// Singleton-Instanz
export const mapboxTokenManager = new MapboxTokenManager();

// Convenience-Funktion für einfache Verwendung
export async function getMapboxToken(): Promise<string> {
  return mapboxTokenManager.getToken();
}

// Mapbox GL Access Token setzen
export async function setMapboxAccessToken(): Promise<void> {
  const token = await getMapboxToken();
  
  // Note: mapboxgl.accessToken should be set directly in components that import mapboxgl
  // This avoids conflicts with static imports
  return Promise.resolve();
}