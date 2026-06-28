"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import type { Tournament } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  draft: "text-gray-600 bg-gray-100",
  generating: "text-yellow-700 bg-yellow-100",
  ready: "text-green-700 bg-green-100",
  error: "text-red-700 bg-red-100",
};

export default function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTournament = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${id}`);
    if (res.ok) setTournament(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  // Poll while generating
  useEffect(() => {
    if (tournament?.status !== "generating") return;
    const interval = setInterval(fetchTournament, 3000);
    return () => clearInterval(interval);
  }, [tournament?.status, fetchTournament]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    const res = await fetch(`/api/tournaments/${id}/generate`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Generation failed.");
    }
    setGenerating(false);
    fetchTournament();
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewUrl(null);
    const res = await fetch(`/api/tournaments/${id}/preview`);
    if (res.ok) {
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } else {
      setError("Preview failed — check your field config.");
    }
    setPreviewLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!tournament) {
    return <div className="text-center py-20 text-gray-500">Tournament not found.</div>;
  }

  const isGenerating = tournament.status === "generating" || generating;
  const isReady = tournament.status === "ready";

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700">← All Tournaments</a>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-gray-500 mt-1">
              {new Date(tournament.eventDate).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[tournament.status]}`}>
            {tournament.status}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isReady && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Generate Certificates</h2>
          <p className="text-sm text-gray-500 mb-4">
            This will render one certificate per participant, upload them to Google Drive,
            and populate the table below with clickable links.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePreview}
              disabled={previewLoading || isGenerating}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {previewLoading ? "Loading preview…" : "Preview Sample"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Generating…
                </>
              ) : (
                "Generate All Certificates"
              )}
            </button>
          </div>

          {isGenerating && (
            <p className="text-sm text-yellow-600 mt-3 animate-pulse">
              Rendering certificates and uploading to Google Drive. This may take a few minutes…
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Certificate Preview (longest name)</h2>
            <button onClick={() => setPreviewUrl(null)} className="text-gray-400 hover:text-gray-600 text-sm">
              Close
            </button>
          </div>
          <img src={previewUrl} alt="Certificate preview" className="w-full rounded-lg border border-gray-100 shadow-sm" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {tournament.errorMessage && tournament.status === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
          <strong>Error:</strong> {tournament.errorMessage}
        </div>
      )}

      {/* Drive Folder Link */}
      {tournament.driveFolderLink && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">All certificates are in a shared Google Drive folder</p>
            <p className="text-xs text-blue-600 mt-0.5">Anyone with the link can view</p>
          </div>
          <a
            href={tournament.driveFolderLink}
            target="_blank"
            rel="noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Open Folder ↗
          </a>
        </div>
      )}

      {/* Certificates Table */}
      {isReady && tournament.certificates.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Certificates ({tournament.certificates.length})
            </h2>
            <input
              type="text"
              placeholder="Search by name…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                const rows = document.querySelectorAll("[data-name]");
                rows.forEach((r) => {
                  const name = r.getAttribute("data-name") || "";
                  (r as HTMLElement).style.display = name.includes(q) ? "" : "none";
                });
              }}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-6 py-3">#</th>
                  <th className="text-left px-6 py-3">Recipient</th>
                  <th className="text-left px-6 py-3">Generated At</th>
                  <th className="text-left px-6 py-3">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tournament.certificates.map((cert, i) => (
                  <tr key={cert.driveFileId} data-name={cert.recipientName.toLowerCase()} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{cert.recipientName}</td>
                    <td className="px-6 py-3 text-gray-400">
                      {new Date(cert.generatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <a
                        href={cert.driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                        View Certificate
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !isGenerating && tournament.status !== "error" && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📜</p>
            <p className="font-medium">No certificates generated yet.</p>
            <p className="text-sm mt-1">Click "Generate All Certificates" above to start.</p>
          </div>
        )
      )}
    </div>
  );
}
