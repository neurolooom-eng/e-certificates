"use client";

import { usePathname } from "next/navigation";

/**
 * Admin pages sit in a padded container; public certificate pages are
 * full-bleed so their cream backdrop reaches the edges of the window.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === "/" || pathname.startsWith("/share/");

  if (isPublic) return <>{children}</>;

  return <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>;
}
