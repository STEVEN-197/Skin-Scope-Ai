import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from './types';

export const SUPABASE_URL = 'https://oiepakmeezaqiorhsbom.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXBha21lZXphcWlvcmhzYm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4OTczMzAsImV4cCI6MjExMDQ3MzMzMH0.CbiNyOIAI6QMp75caCkdbHntU9N4GksT-SwCSiobfHg';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'skinscopeai-expo-native',
    },
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
