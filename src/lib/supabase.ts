import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = false;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    isConfigured = true;
  } catch (e) {
    console.warn('Supabase client creation failed:', e);
  }
}

export const supabase = supabaseInstance;
export const isSupabaseReady = isConfigured;
