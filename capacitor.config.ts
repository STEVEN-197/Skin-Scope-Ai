import type { CapacitorConfig } from '@capacitor/cli';

const VERCEL_URL = 'https://skinscopeai-main.vercel.app';

const config: CapacitorConfig = {
  appId: 'app.lovable.skinscopeai',
  appName: 'SkinScope AI',
  webDir: 'dist/client',
  bundledWebRuntime: false,

  server: {
    url: VERCEL_URL,
    androidScheme: 'https',
    cleartext: true,
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    initialFocus: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
