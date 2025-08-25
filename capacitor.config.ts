import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8322f6bacc57473a99813410e1f38eea',
  appName: 'Eventourismo',
  webDir: 'dist',
  server: {
    url: 'https://8322f6ba-cc57-473a-9981-3410e1f38eea.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1625',
      showSpinner: false
    }
  }
};

export default config;