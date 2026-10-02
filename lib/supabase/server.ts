import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseEnv } from "./env";

/**
 * Server-side Supabase client.
 *
 * Uses the PUBLISHABLE key on purpose. Every read performed by the server is a
 * read of a public birthday page, which RLS already permits. Using a secret
 * key here would mean the public page silently stopped being subject to the
 * policies we carefully wrote, which would hide policy mistakes until they
 * mattered.
 *
 * Only `NEXT_PUBLIC_*` values are read, so this module is safe to import from
 * anywhere; it is still kept out of client code so there is exactly one place
 * that talks to Supabase from the server.
 */
export function createServerSupabase(): SupabaseClient | null {
  const env = readPublicSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.publishableKey, {
    auth: {
      // No accounts in Phase 5. Explicitly disabled so the SDK never attempts
      // a token refresh or persists anything to localStorage.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "birthday-studio/phase5" },
    },
  });
}
