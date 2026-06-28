"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/tournaments" className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <span className="text-xl font-bold text-gray-900">E-Certificates</span>
          </a>

          <div className="flex items-center gap-4">
            {session ? (
              <>
                <a
                  href="/tournaments/new"
                  className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  + New Tournament
                </a>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {session.user?.name}
                  </span>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-sm text-gray-400 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <a
                href="/login"
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sign In
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
