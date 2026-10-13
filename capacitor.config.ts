import type { CapacitorConfig } from '@capacitor/cli';

const VERCEL_URL = 'https://skinscopeai-main.vercel.app';

const config: CapacitorConfig = {
  appId: 'app.lovable.skinscopeai',
  appName: 'SkinScope AI',
  webDir: 'dist/client',
  bundledWebRuntime: false,

  server: {
    // ⚡ Point native WebView to live Vercel deployment
    url: VERCEL_URL,
    androidScheme: 'https',
    hostname: 'skinscopeai-main.vercel.app',
    // Allow all navigation so WebView can reach Supabase, CDNs, and Vercel routes freely
    allowNavigation: [
      'skinscopeai-main.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
      '*.supabase.in',
      'nrvptzzddpenyvcndcph.supabase.co',
      '*',
    ],
    cleartext: true,
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    initialFocus: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
    // NOTE: CapacitorHttp is intentionally NOT enabled here.
    // Enabling CapacitorHttp breaks @supabase/supabase-js because it intercepts
    // window.fetch and drops auth headers/cookies.
  },
};

export default config;
