/**
 * Supabase environment configuration.
 *
 * Naming follows the current Supabase API-key documentation:
 *   - `sb_publishable_...` keys replaced the legacy `anon` JWT and are safe to
 *     ship to a browser. The legacy `anon` / `service_role` keys are
 *     deprecated and are deliberately NOT read by this project.
 *   - `sb_secret_...` keys replaced `service_role` and bypass RLS. They are
 *     only ever read from server-only modules and are never given a
 *     `NEXT_PUBLIC_` prefix, which is what keeps them out of the client bundle.
 *
 * Nothing here throws at import time. A missing configuration must render a
 * helpful screen, not crash the route.
 */

export const SUPABASE_ENV = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  secretKey: "SUPABASE_SECRET_KEY",
} as const;

export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

/**
 * A project URL we can actually talk to.
 *
 * These MUST stay written as static `process.env.NEXT_PUBLIC_*` property
 * reads. The bundler substitutes those specific literals at build time; a
 * computed lookup such as `process.env[SUPABASE_ENV.url]` is left alone and
 * arrives in the browser as `undefined`, which made the client believe the app
 * was unconfigured. `SUPABASE_ENV` above is for messages and greps only.
 */
function readUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

function readPublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The publishable configuration, or `null` when the project has not been wired
 * up yet. Callers must handle `null` and show a setup message rather than
 * letting a raw SDK error reach the user.
 */
export function readPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = readUrl();
  const publishableKey = readPublishableKey();

  if (!url || !publishableKey) return null;
  if (!looksLikeUrl(url)) return null;
  if (publishableKey.length < 20) return null;

  return { url: url.replace(/\/+$/, ""), publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return readPublicSupabaseEnv() !== null;
}

/**
 * NOTE: the secret key is deliberately NOT read here.
 *
 * This module is imported by the browser client, so anything that touches
 * `SUPABASE_SECRET_KEY` would sit inside the client module graph. It currently
 * gets tree-shaken because no client code calls it, but that is a property of
 * the optimizer rather than a guarantee of the module boundary. The reader
 * lives in `admin.ts`, which is server-only and is the single consumer, so the
 * graph boundary enforces the rule instead of luck.
 */

/** Copy shown to the developer when the project is not configured. */
export const SUPABASE_SETUP_MESSAGE =
  "Saving a birthday needs a Supabase project. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.";
