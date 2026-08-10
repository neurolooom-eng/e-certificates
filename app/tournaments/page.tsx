"use client";

import { useEffect, useState } from "react";
import type { Tournament } from "@/lib/types";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  previewed: "bg-blue-100 text-blue-700",
  generating: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tournament | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/tournaments");
    const data = await res.json();
    setTournaments(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleArchive(t: Tournament) {
    setMenuOpen(null);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !t.archived }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to update tournament.");
    }
    await load();
    setBusy(false);
  }

  async function doDelete(t: Tournament) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to delete tournament.");
    }
    setConfirmDelete(null);
    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  const active = tournaments.filter((t) => !t.archived);
  const archived = tournaments.filter((t) => t.archived);
  const visible = showArchived ? archived : active;

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
    <div onClick={() => menuOpen && setMenuOpen(null)}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
        <a
          href="/tournaments/new"
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Tournament
        </a>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            !showArchived
              ? "border-brand-500 text-brand-500"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Active <span className="text-gray-400">({active.length})</span>
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            showArchived
              ? "border-brand-500 text-brand-500"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Archived <span className="text-gray-400">({archived.length})</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">{showArchived ? "📦" : "🏆"}</p>
          <p className="font-medium">
            {showArchived ? "No archived tournaments." : "No active tournaments."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((t) => (
            <div
              key={t.id}
              className={`relative bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow ${
                t.archived ? "opacity-60" : ""
              }`}
            >
              {/* Actions menu */}
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(menuOpen === t.id ? null : t.id);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center text-lg leading-none"
                  aria-label="Tournament actions"
                >
                  ⋯
                </button>
                {menuOpen === t.id && (
                  <div
                    className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleArchive(t)}
                      disabled={busy}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                    >
                      {t.archived ? "↩ Restore" : "📦 Archive"}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(null); setConfirmDelete(t); }}
                      disabled={busy}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 disabled:opacity-50"
                    >
                      🗑 Delete permanently
                    </button>
                  </div>
                )}
              </div>

              <a href={`/tournaments/${t.id}`} className="block p-5">
                <div className="flex items-start justify-between mb-3 pr-8">
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight">{t.name}</h3>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[t.status]}`}>
                    {t.status}
                  </span>
                  {t.archived && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-500">
                      archived
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  {new Date(t.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                {t.certificates.length > 0 && (
                  <p className="text-sm font-medium text-brand-500">
                    {t.certificates.length} certificate{t.certificates.length !== 1 ? "s" : ""} generated
                  </p>
                )}
                {t.status === "draft" && <p className="text-sm text-gray-400">Ready to generate</p>}
                {t.status === "generating" && (
                  <p className="text-sm text-yellow-600 animate-pulse">Generating certificates…</p>
                )}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete this tournament?</h2>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{confirmDelete.name}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-5">
              This permanently deletes the tournament and all{" "}
              {confirmDelete.certificates.length > 0 ? confirmDelete.certificates.length : ""} generated
              certificates. Existing certificate links will stop working. This cannot be undone — archive
              it instead if you just want it out of the way.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={busy}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => toggleArchive(confirmDelete)}
                disabled={busy}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Archive instead
              </button>
              <button
                onClick={() => doDelete(confirmDelete)}
                disabled={busy}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {busy && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
