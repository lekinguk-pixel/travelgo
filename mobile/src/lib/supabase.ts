import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabasePublishableKey?: string };

if (!extra.supabaseUrl || !extra.supabasePublishableKey) {
  throw new Error('Supabase settings are missing from app.json (extra.supabaseUrl / extra.supabasePublishableKey).');
}

export const supabase = createClient(extra.supabaseUrl, extra.supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Turns a Supabase / Postgres error into the message we raised in SQL. */
export function friendlyError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return 'Something went wrong. Check your connection and try again.';
}
