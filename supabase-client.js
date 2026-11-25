const config = window.WOVEN_JEWELS_CONFIG;

export function isSupabaseConfigured() {
  return Boolean(
    config &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl) &&
    config.supabaseAnonKey &&
    !config.supabaseAnonKey.includes("YOUR_SUPABASE")
  );
}

export async function createSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set the project URL and public anon key in site-config.js.");
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });
}
