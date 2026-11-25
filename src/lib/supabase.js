import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";
const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);

export const supabaseConfigured = Boolean(
  validUrl && anonKey && !anonKey.includes("YOUR_SUPABASE")
);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect Supabase.");
  }
  return supabase;
}
