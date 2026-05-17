import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a proxy that throws a helpful error when any property is accessed
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error(
          'Supabase configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the app settings (Secrets panel).'
        );
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = getSupabaseClient();

/**
 * SECURITY REMINDER:
 * 
 * To ensure data security, you MUST enable Row Level Security (RLS) on all your tables in the Supabase dashboard.
 * 
 * For example, for a 'readings' table:
 * 1. Go to Authentication -> Policies
 * 2. Enable RLS for the 'readings' table.
 * 3. Create a policy: "Users can only access their own data"
 *    - Definition: auth.uid() = user_id
 *    - Allowed operations: SELECT, INSERT, UPDATE, DELETE
 */
