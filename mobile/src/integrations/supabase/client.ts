import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from './types';

export const SUPABASE_URL = 'https://nrvptzzddpenyvcndcph.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydnB0enpkZHBlbnl2Y25kY3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTA3NzgsImV4cCI6MjA5MjI4Njc3OH0.ezxhA48lnXD_wFwyBHbwPCzLhjFPp54TrFGKc51Yf6E';

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
