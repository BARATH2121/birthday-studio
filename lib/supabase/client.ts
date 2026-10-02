import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseEnv } from "./env";

/**
 * Browser Supabase client, created lazily and memoised.
 *
 * Uses ONLY the publishable key. This module must never read a secret key: it
 * is bundled into the client, where anything it reads is public.
 */
let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;

  const env = readPublicSupabaseEnv();
  if (!env) return null;

  cached = createClient(env.url, env.publishableKey, {
    auth: {
      // Phase 5 has no accounts. Disabling the session machinery guarantees
      // nothing is written to localStorage and no token refresh ever runs.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
