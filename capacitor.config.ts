import type { CapacitorConfig } from '@capacitor/cli';

// Detect if running inside Capacitor native context (android/ios build)
const isNative = process.env.CAPACITOR_PLATFORM !== undefined;

const config: CapacitorConfig = {
  appId: 'app.lovable.skinscopeai',
  appName: 'SkinScope AI',
  webDir: 'dist/client',
  // Do NOT bundle the Capacitor runtime — it's already in the native shell
  bundledWebRuntime: false,
  server: {
    // Use https scheme so Supabase auth callbacks work properly
    androidScheme: 'https',
    // hostname is what the WebView uses — keep it stable
    hostname: 'skinscopeai.app',
    // Allow cleartext (HTTP) for dev reload only; production uses bundled assets
    allowNavigation: ['*.supabase.co', '*.supabase.in', 'nrvptzzddpenyvcndcph.supabase.co'],
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // Ensures the WebView loads bundled assets, not a remote URL
    webContentsDebuggingEnabled: false,
    // Larger initial scale looks better on small phones
    initialFocus: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
    // Ensure local storage is persisted
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
