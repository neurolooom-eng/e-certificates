import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * Admin diagnostic: what is actually in the object store, independent of the
 * index. Answers "is the data gone, or just not being listed?" without
 * guessing.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  if (!process.env.VERCEL) {
    return NextResponse.json({ env: "local", note: "Blob storage is only used on Vercel." });
  }

  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "tournaments/" });

    const records = blobs.filter((b) => b.pathname.endsWith("/tournament.json"));
    const index = blobs.find((b) => b.pathname === "tournaments/index.json");

    let indexEntries: number | string = "missing";
    if (index) {
      const res = await fetch(index.url, { cache: "no-store" });
      indexEntries = res.ok ? ((await res.json()) as unknown[]).length : `unreadable (${res.status})`;
    }

    return NextResponse.json({
      env: "vercel",
      indexEntries,
      tournamentRecords: records.length,
      certificateFiles: blobs.filter((b) => b.pathname.includes("/certs/")).length,
      tournaments: records.map((r) => r.pathname.split("/")[1]),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
