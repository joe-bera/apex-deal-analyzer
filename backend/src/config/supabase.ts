import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';

/**
 * Supabase client with anon key (for client-side operations)
 * Use this for operations that respect Row Level Security (RLS)
 */
export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We're using this server-side
    },
  }
);

/**
 * Supabase admin client with service role key (bypasses RLS)
 * Use this ONLY for:
 * - Admin operations
 * - Background jobs
 * - Operations that need to bypass RLS
 *
 * WARNING: This client has full database access. Use carefully!
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Get Supabase client with user context
 * Use this for authenticated requests to enforce RLS
 */
export const getSupabaseClient = (accessToken?: string): SupabaseClient => {
  if (!accessToken) {
    return supabase;
  }

  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Test connection on startup
if (config.server.isDevelopment) {
  supabase
    .from('profiles')
    .select('count')
    .limit(1)
    .then(() => {
      console.log('✅ Supabase connection successful');
    })
    .catch((error) => {
      console.warn('⚠️  Supabase connection test failed (table may not exist yet):', error.message);
    });
}
