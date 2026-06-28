"use client";

import { useEffect, useState } from "react";
import type { Tournament } from "@/lib/types";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  generating: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((data) => setTournaments(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No tournaments yet</h2>
        <p className="text-gray-500 mb-6">Create your first tournament to get started.</p>
        <a
          href="/tournaments/new"
          className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Create Tournament
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
        <a
          href="/tournaments/new"
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Tournament
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((t) => (
          <a
            key={t.id}
            href={`/tournaments/${t.id}`}
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">{t.name}</h3>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 shrink-0 ${STATUS_BADGE[t.status]}`}>
                {t.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {new Date(t.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            {t.certificates.length > 0 && (
              <p className="text-sm font-medium text-brand-500">
                {t.certificates.length} certificate{t.certificates.length !== 1 ? "s" : ""} generated
              </p>
            )}
            {t.status === "draft" && (
              <p className="text-sm text-gray-400">Ready to generate</p>
            )}
            {t.status === "generating" && (
              <p className="text-sm text-yellow-600 animate-pulse">Generating certificates…</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
