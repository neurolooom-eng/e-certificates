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
      const viaSdk = await fetchBlob(record.url);
      readable[id] = `publicUrl=${direct}, sdkRead=${viaSdk?.stream ? "ok" : "failed"}`;
    }

    let indexStatus = "missing";
    if (index) {
      const content = await fetchBlob(index.url);
      if (content?.stream) {
        const parsed = JSON.parse(await new Response(content.stream).text()) as unknown[];
        indexStatus = `ok — ${parsed.length} entries`;
      } else {
        indexStatus = "unreadable";
      }
    }

    return NextResponse.json({
      env: "vercel",
      blobsSeen: blobs.length,
      index: indexStatus,
      tournamentRecords: records.length,
      certificateFiles: blobs.filter((b) => b.pathname.includes("/certs/")).length,
      storeServesPublicUrls: Object.values(readable).every((v) => v.startsWith("publicUrl=ok")),
      recordReadable: readable,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { env: "vercel", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
