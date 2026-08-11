import { NextResponse } from "next/server";

/**
 * Storage diagnostic: what is actually in the object store, and whether each
 * piece can be read back. Deliberately reachable without a session — when
 * something is wrong, auth may be exactly what's failing, and this reports
 * only counts and IDs, never certificate contents or personal data.
 */
export async function GET() {
  if (!process.env.VERCEL) {
    return NextResponse.json({ env: "local", note: "Blob storage is only used on Vercel." });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ env: "vercel", error: "BLOB_READ_WRITE_TOKEN is not set." }, { status: 500 });
  }

  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "tournaments/" });

    const records = blobs.filter((b) => b.pathname.endsWith("/tournament.json"));
    const index = blobs.find((b) => b.pathname === "tournaments/index.json");

    // Actually read each record — "the object exists" and "the app can read
    // it" are different failures, and only the second explains a blank list.
    const readable: Record<string, string> = {};
    for (const record of records) {
      const id = record.pathname.split("/")[1];
      try {
        const res = await fetch(record.url, { cache: "no-store" });
        readable[id] = res.ok ? "ok" : `HTTP ${res.status}`;
      } catch (err: unknown) {
        readable[id] = `fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    let indexStatus = "missing";
    if (index) {
      try {
        const res = await fetch(index.url, { cache: "no-store" });
        indexStatus = res.ok
          ? `ok — ${((await res.json()) as unknown[]).length} entries`
          : `HTTP ${res.status}`;
      } catch (err: unknown) {
        indexStatus = `fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    return NextResponse.json({
      env: "vercel",
      blobsSeen: blobs.length,
      index: indexStatus,
      tournamentRecords: records.length,
      certificateFiles: blobs.filter((b) => b.pathname.includes("/certs/")).length,
      recordReadable: readable,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { env: "vercel", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
