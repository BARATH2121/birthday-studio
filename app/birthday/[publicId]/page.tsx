import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  AUDIO_BUCKET,
  PHOTO_BUCKET,
  READ_BIRTHDAY_RPC,
  isValidAudioPath,
  isValidPublicId,
  rowToBirthday,
  type BirthdayPageRow,
} from "@/lib/birthday-page";
import BirthdayPage from "@/components/birthday/birthday-page";

/**
 * How long a signed audio URL stays playable.
 *
 * A short ceiling on its own: the audio is a background track for a page someone
 * has already opened, not a download. Two hours is comfortably longer than any
 * single visit without making a leaked URL a durable asset.
 */
const AUDIO_URL_TTL_SECONDS = 2 * 60 * 60;

/**
 * Signs the audio object, for a time no longer than the page's own remaining life.
 *
 * Capping the lifetime at the page expiry is the point: without it, a URL minted
 * an hour before midnight would still play for another hour after the birthday
 * was over, which is exactly the "expired page still serves media" problem the
 * private bucket exists to prevent.
 *
 * Returns "" on any failure, or when there is no usable life left. The page then
 * renders without audio rather than failing outright — a missing track is a
 * worse-but-valid page, and the alternative is that a Storage hiccup takes the
 * whole birthday down.
 */
async function signAudioUrl(
  path: string,
  expiresAt: string,
): Promise<string> {
  const admin = getAdminSupabase();
  if (!admin) return "";

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs)) return "";

  /*
   * Sub-second remaining life, or none: the page is at or past its expiry. The
   * RPC already filters these out, so reaching this point means the request
   * itself took longer than the page's last moments — not worth a token.
   */
  const seconds = Math.floor(remainingMs / 1000);
  if (seconds < 1) return "";

  /*
   * The only floor is the single second Storage requires for a valid positive
   * TTL. An earlier version floored this at a minute to avoid "URLs expiring
   * mid-render", which quietly defeated the cap above: a page with ten seconds
   * left got a URL good for sixty, and kept playing audio for a minute after it
   * was gone. Losing the last second of a track is the intended trade.
   */
  const ttl = Math.min(AUDIO_URL_TTL_SECONDS, seconds);

  const { data, error } = await admin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, ttl);

  if (error || !data?.signedUrl) {
    console.error("[birthday] failed to sign audio", {
      message: error?.message,
    });
    return "";
  }

  return data.signedUrl;
}

/**
 * A public birthday page.
 *
 * Rendered on the server, and only ever for one specific page: the one whose
 * 128-bit id is in the URL. There is no index, no list, no count, and no way to
 * ask the database for "some other birthday page" — the id is the entire query.
 */
export default async function BirthdaySharePage({
  params,
}: PageProps<"/birthday/[publicId]">) {
  const { publicId } = await params;

  // Reject anything that is not a well-formed id before it reaches the
  // database. The RPC would return nothing anyway, but failing here avoids a
  // pointless round trip and makes the behaviour obvious.
  if (!isValidPublicId(publicId)) {
    notFound();
  }

  // The publishable key is used deliberately. If this page read through a
  // secret key, a bug in the RLS policies would be invisible, because a secret
  // key silently bypasses them. Reading as the anon role means the public page
  // only works if the policies are genuinely correct.
  const supabase = createServerSupabase();
  if (!supabase) {
    return <SetupNotice />;
  }

  const { data, error } = await supabase.rpc(READ_BIRTHDAY_RPC, {
    p_public_id: publicId,
  });

  if (error) {
    // Never surface the PostgREST message: it can name schemas, functions and
    // constraints. A generic not-found is both safer and less alarming.
    console.error("[birthday] failed to load page", {
      code: error.code,
      message: error.message,
    });
    notFound();
  }

  const rows = (data ?? []) as BirthdayPageRow[];
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) {
    notFound();
  }

  // Photos are in a public bucket, so their URL is derivable from the path by
  // anyone holding the page HTML. Audio is in a private bucket, so its URL has
  // to be signed here and it is capped at the page's own expiry.
  const audioUrl =
    typeof row.audio_path === "string" && isValidAudioPath(row.audio_path)
      ? await signAudioUrl(row.audio_path, row.expires_at)
      : "";

  const birthday = rowToBirthday(
    row,
    (path) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl,
    () => audioUrl,
  );

  if (!birthday) {
    notFound();
  }

  return (
    <main id="main" className="bs-shell flex-1 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <BirthdayPage draft={birthday.draft} />
      </div>
    </main>
  );
}

/**
 * Shown only when the deployment has no Supabase credentials. This is a
 * developer-facing state, not a visitor error, so it names the missing
 * variables instead of pretending the link is broken.
 */
function SetupNotice() {
  return (
    <main id="main" className="bs-shell flex-1 py-10 sm:py-14">
      <section className="bs-card mx-auto w-full max-w-md rounded-[1.75rem] p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Birthday pages are not connected yet
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            This deployment is missing the environment variables it needs to read
            saved birthday pages.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].map(
              (name) => (
                <li
                  key={name}
                  className="rounded-lg border border-white/10 bg-night-950/40 px-3 py-2 font-mono text-xs text-white/70"
                >
                  {name}
                </li>
              ),
            )}
          </ul>
          <p className="mt-4 text-sm text-white/50">
            See <code>docs/phase5-supabase-setup.md</code> for the full setup.
          </p>
        </section>
      </main>
  );
}

/**
 * Page-specific metadata.
 *
 * The creator's chosen name goes in the title so the link preview in a chat
 * app is meaningful. `noindex` prevents an unguessable-but-shared URL from
 * being crawled, and the description is generic on purpose — there is no reason
 * to repeat the personal message into search results.
 */
export async function generateMetadata({
  params,
}: PageProps<"/birthday/[publicId]">): Promise<Metadata> {
  const { publicId } = await params;

  if (!isValidPublicId(publicId)) {
    return { title: "Birthday surprise not found" };
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return { title: "Birthday Studio" };
  }

  const { data } = await supabase.rpc(READ_BIRTHDAY_RPC, {
    p_public_id: publicId,
  });

  const rows = (data ?? []) as BirthdayPageRow[];
  const name = Array.isArray(rows) ? rows[0]?.name?.trim() : "";

  return {
    title: name ? `A birthday surprise for ${name}` : "A birthday surprise",
    description: "Someone made you a birthday page. Open it.",
    robots: { index: false, follow: false },
  };
}
