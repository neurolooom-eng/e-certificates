import { NextResponse } from "next/server";
import { fetchBlob } from "@/lib/storage";

const ALLOWED_HOST_SUFFIX = ".blob.vercel-storage.com";

/**
 * Serves a stored certificate.
 *
 * Certificate links point at the object store, but a store that isn't serving
 * public URLs answers 403 to the participant clicking the link. This fetches
 * the object with the store token and streams it back.
 *
 * Only blob-storage URLs are accepted, so this can't be used as an open proxy.
 */
export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("u");
  if (!target) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return NextResponse.json({ error: "Unsupported file location" }, { status: 400 });
  }

  const res = await fetchBlob(parsed.toString());
  if (!res?.ok) {
    return NextResponse.json({ error: "Certificate unavailable" }, { status: res?.status ?? 502 });
  }

  const filename = parsed.pathname.split("/").pop() || "certificate.png";
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/png",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
