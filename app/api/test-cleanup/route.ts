import {
  cleanupOrphanedAudio,
  cleanupOrphanedPhotos,
  cleanupStaleOrphanedPhotos,
} from "@/app/actions/cleanup-orphan-photos";

/**
 * Test-only entry point for the orphan cleanup server action.
 *
 * The action is a `"use server"` export, which the client can already call
 * directly; it is not a normal HTTP route handler. This endpoint exists purely
 * so the Phase 5 test suite can drive the real action over HTTP and assert on
 * its real behaviour, including the guard that refuses to delete a live page's
 * photos.
 *
 * DEVELOPMENT ONLY. This handler is a public, unauthenticated HTTP endpoint in
 * front of the one code path that holds SUPABASE_SECRET_KEY. It is not safe to
 * expose in production even though the action re-validates every path and
 * re-checks ownership on every call: that narrows the blast radius to genuinely
 * orphaned objects, it does not make an unauthenticated mass-delete endpoint
 * appropriate for a public site. `NODE_ENV === "production"` is inlined by
 * Next at build time, so this branch is dead code in a production bundle and the
 * endpoint 404s.
 *
 * The directory is deliberately NOT named with a leading underscore: Next
 * treats `_folder` as a private folder and excludes it from routing entirely,
 * which would make this endpoint 404 in development and the test silently
 * meaningless.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  let body: { paths?: unknown; mode?: unknown; bucket?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // Sweep mode drives the age-gated stale sweeper. It takes no paths: the sweeper
  // decides for itself which folders are old enough and unreferenced.
  if (body?.mode === "sweep") {
    return Response.json(await cleanupStaleOrphanedPhotos());
  }

  if (!Array.isArray(body?.paths)) {
    return Response.json({ error: "paths must be an array" }, { status: 400 });
  }

  /*
   * The bucket is chosen from a fixed set of literals rather than from the
   * request. A caller-supplied bucket name would be a caller choosing which
   * bucket the secret key points at, and the cleanup actions deliberately expose
   * two named entry points instead of taking the bucket as an argument.
   */
  if (body?.bucket === "audio") {
    return Response.json(await cleanupOrphanedAudio(body.paths as string[]));
  }

  if (body?.bucket !== undefined && body.bucket !== "photos") {
    return Response.json({ error: "unknown bucket" }, { status: 400 });
  }

  const result = await cleanupOrphanedPhotos(body.paths as string[]);
  return Response.json(result);
}
