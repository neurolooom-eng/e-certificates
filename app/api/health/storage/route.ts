import { NextResponse } from "next/server";
import { fetchBlob } from "@/lib/storage";
import { isR2Configured, r2List, r2GetBuffer, r2ConfigProblem, accountId, publicBaseUrl, describeR2Env } from "@/lib/r2";

/**
 * Storage diagnostic: what is actually in the object store, and whether each
 * piece can be read back. Deliberately reachable without a session — when
 * something is wrong, auth may be exactly what's failing, and this reports
 * only counts and IDs, never certificate contents or personal data.
 */
export async function GET() {
  if (!process.env.VERCEL && !isR2Configured()) {
    return NextResponse.json({ env: "local", note: "Using the local filesystem; no object store configured." });
  }
  if (!isR2Configured() && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "No storage configured. Set the R2_* variables (recommended) or BLOB_READ_WRITE_TOKEN." },
      { status: 500 }
    );
  }

  // Cloudflare R2 takes precedence when configured
  if (isR2Configured()) {
    // A malformed value fails as an opaque SDK error, so check the shape first
    // and say which variable is wrong.
    const problem = r2ConfigProblem();
    if (problem) {
      return NextResponse.json(
        { backend: "cloudflare-r2", configError: problem, variables: describeR2Env() },
        { status: 500 }
      );
    }

    try {
      const keys = await r2List("tournaments/");
      const records = keys.filter((k) => k.endsWith("/tournament.json"));
      const readable: Record<string, string> = {};
      for (const key of records) {
        const buf = await r2GetBuffer(key);
        readable[key.split("/")[1]] = buf ? "ok" : "unreadable";
      }
      const index = await r2GetBuffer("tournaments/index.json");
      return NextResponse.json({
        backend: "cloudflare-r2",
        bucket: process.env.R2_BUCKET?.trim(),
        servedFrom: publicBaseUrl() ? `public bucket URL (${publicBaseUrl()})` : "through the app",
        objectsSeen: keys.length,
        index: index ? `ok — ${(JSON.parse(index.toString()) as unknown[]).length} entries` : "missing",
        tournamentRecords: records.length,
        certificateFiles: keys.filter((k) => k.includes("/certs/")).length,
        recordReadable: readable,
      });
    } catch (err: unknown) {
      return NextResponse.json(
        {
          backend: "cloudflare-r2",
          error: err instanceof Error ? err.message : String(err),
          endpoint: `https://${accountId()}.r2.cloudflarestorage.com`,
          bucket: process.env.R2_BUCKET?.trim(),
        },
        { status: 500 }
      );
    }
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
