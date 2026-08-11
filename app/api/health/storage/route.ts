import { NextResponse } from "next/server";
import { fetchBlob } from "@/lib/storage";

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

    // Read each record two ways. A public store answers both; a private one
    // 403s the plain fetch and only answers the authenticated read — which is
    // exactly why certificate links needed to move behind /api/file.
    const readable: Record<string, string> = {};
    for (const record of records) {
      const id = record.pathname.split("/")[1];
      let direct = "?";
      try {
        const res = await fetch(record.url, { cache: "no-store" });
        direct = res.ok ? "ok" : `HTTP ${res.status}`;
      } catch (err: unknown) {
        direct = `failed: ${err instanceof Error ? err.message : String(err)}`;
      }
      const withToken = await fetchBlob(record.url);
      readable[id] = `public=${direct}, authenticated=${withToken?.ok ? "ok" : `HTTP ${withToken?.status ?? "failed"}`}`;
    }

    let indexStatus = "missing";
    if (index) {
      const res = await fetchBlob(index.url);
      indexStatus = res?.ok
        ? `ok — ${((await res.json()) as unknown[]).length} entries`
        : `unreadable (HTTP ${res?.status ?? "failed"})`;
    }

    return NextResponse.json({
      env: "vercel",
      blobsSeen: blobs.length,
      index: indexStatus,
      tournamentRecords: records.length,
      certificateFiles: blobs.filter((b) => b.pathname.includes("/certs/")).length,
      storeIsPublic: Object.values(readable).every((v) => v.startsWith("public=ok")),
      recordReadable: readable,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { env: "vercel", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
