import type { CapacitorConfig } from '@capacitor/cli';

// ─────────────────────────────────────────────────────────────────────────────
// SkinScope AI — Capacitor Native Config
//
// Strategy: REMOTE-URL mode
//   The native APK shell loads the live Vercel deployment
//   (https://skinscopeai-main.vercel.app) directly inside the WebView.
//
//   Benefits:
//     ✅ Always up-to-date — web changes deploy without rebuilding the APK
//     ✅ Native shell — splash screen, status bar, hardware camera access
//     ✅ Native plugins — @capacitor/camera, local storage, biometrics
//     ✅ Supabase auth — same backend as the web app
//
//   Offline fallback:
//     The bundled dist/client assets are still packed into the APK.
//     If you ever want to switch back to offline-only mode, comment out
//     the `server.url` line below.
// ─────────────────────────────────────────────────────────────────────────────

const VERCEL_URL = 'https://skinscopeai-main.vercel.app';

const config: CapacitorConfig = {
  appId: 'app.lovable.skinscopeai',
  appName: 'SkinScope AI',
  // Keep the bundled web assets for offline fallback
  webDir: 'dist/client',
  bundledWebRuntime: false,

  server: {
    // ⚡ Point the native WebView at the live Vercel deployment
    url: VERCEL_URL,
    // Use https scheme — required for Supabase auth and secure cookies
    androidScheme: 'https',
    // Stable hostname for Capacitor bridge communication
    hostname: 'skinscopeai-main.vercel.app',
    // Allow navigation to these external origins (Supabase API calls)
    allowNavigation: [
      'skinscopeai-main.vercel.app',
      '*.supabase.co',
      '*.supabase.in',
      'nrvptzzddpenyvcndcph.supabase.co',
    ],
    cleartext: false,
  },

  android: {
    // Allow the WebView to load the Vercel HTTPS origin
    allowMixedContent: false,
    // Enable WebView debugging in debug builds (disable for release)
    webContentsDebuggingEnabled: false,
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
    // Use native HTTP client for Supabase calls (bypasses WebView CORS)
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
