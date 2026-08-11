/**
 * Public link for a stored certificate.
 *
 * Object-store URLs are served through our own route, so a store that isn't
 * public still yields a link that works for participants. Local-dev paths
 * (/generated/...) are already served by the app and pass through unchanged.
 */
export function certificateHref(storedUrl: string): string {
  if (!storedUrl) return "";
  if (!storedUrl.startsWith("http")) return storedUrl;
  return `/api/file?u=${encodeURIComponent(storedUrl)}`;
}
