import { NextResponse } from "next/server";
import { fetchBlob } from "@/lib/storage";

const ALLOWED_HOST_SUFFIX = ".blob.vercel-storage.com";

/**
 * Serves a stored certificate.
 *
 * Deliberately public: a certificate link has to work for the participant who
 * receives it, whoever created the tournament and whether or not they have an
 * account. The store's own URLs answer 403, so this reads the object through
 * the SDK and streams it back.
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

  const content = await fetchBlob(parsed.toString());
  if (!content?.stream) {
    return NextResponse.json({ error: "Certificate unavailable" }, { status: 404 });
  }

  const filename = decodeURIComponent(parsed.pathname.split("/").pop() || "certificate.png");
  return new Response(content.stream, {
    headers: {
      "Content-Type": content.contentType ?? "image/png",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
