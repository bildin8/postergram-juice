import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mnksseywxoeswgsanzll.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Client for public/authenticated operations
// Using 'any' for schema until database is set up
export const supabase: SupabaseClient<any, 'public', any> = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for backend operations (bypasses RLS)
export const supabaseAdmin: SupabaseClient<any, 'public', any> = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : supabase;

export { supabaseUrl, supabaseAnonKey };
