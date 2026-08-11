/**
 * Public link for a stored certificate.
 *
 * Object-store URLs are served through our own route, so a store that isn't
 * public still yields a link that works for participants. Local-dev paths
 * (/generated/...) are already served by the app and pass through unchanged.
 */
export function certificateHref(storedUrl: string): string {
  if (!storedUrl) return "";
  // R2 references are already final: either a public bucket URL or our own
  // /api/file?k= route. Local dev paths are served by the app directly.
  if (!storedUrl.startsWith("http")) return storedUrl;
  if (storedUrl.includes(".r2.dev") || storedUrl.includes("r2.cloudflarestorage.com")) return storedUrl;
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL && storedUrl.startsWith(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL)) {
    return storedUrl;
  }
  // Vercel Blob URLs aren't directly fetchable — go through our route
  if (storedUrl.includes(".blob.vercel-storage.com")) {
    return `/api/file?u=${encodeURIComponent(storedUrl)}`;
  }
  return storedUrl;
}
