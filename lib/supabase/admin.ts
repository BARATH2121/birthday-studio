import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseEnv } from "./env";

/**
 * Reads the optional secret key. Server-only, and defined here rather than in
 * `env.ts` because this module is the only consumer and `env.ts` is part of the
 * browser module graph.
 */
function readSecretKey(): string | null {
  const value = process.env.SUPABASE_SECRET_KEY;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Privileged, server-only Supabase client.
 *
 * Used by exactly one code path: deleting photo uploads that were orphaned
 * when saving a birthday page failed. Nothing else may use it.
 *
 * The publishable client cannot do this: the migration deliberately grants
 * anon neither DELETE on `storage.objects` nor UPDATE/DELETE on
 * `birthday_pages`, because a browser client must not be able to remove
 * anyone's photos.
 *
 * Safety properties:
 *   * reads SUPABASE_SECRET_KEY only — never a NEXT_PUBLIC_ variable, so the
 *     bundler cannot inline it;
 *   * throws if it is ever reached from a browser, turning a future
 *     mis-import into an immediate loud failure instead of a silent leak;
 *   * returns null when the key is absent, so the app keeps working on the
 *     publishable key alone and simply skips orphan cleanup.
 */
export function getAdminSupabase(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "getAdminSupabase() is server-only and must never run in the browser.",
    );
  }

  const env = readPublicSupabaseEnv();
  const secretKey = readSecretKey();
  if (!env || !secretKey) return null;

  return createClient(env.url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
