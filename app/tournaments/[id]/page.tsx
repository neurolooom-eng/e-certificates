"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import type { Tournament } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  draft:      "text-gray-600 bg-gray-100",
  previewed:  "text-blue-700 bg-blue-100",
  generating: "text-yellow-700 bg-yellow-100",
  ready:      "text-green-700 bg-green-100",
  error:      "text-red-700 bg-red-100",
};

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${active ? "opacity-100" : done ? "opacity-60" : "opacity-30"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
        ${done ? "bg-green-500 text-white" : active ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-500"}`}>
        {done ? "✓" : n}
      </div>
      <span className={`text-sm font-medium ${active ? "text-gray-900" : "text-gray-500"}`}>{label}</span>
    </div>
  );
}

export default function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTournament = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${id}`);
    if (res.ok) setTournament(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchTournament(); }, [fetchTournament]);

  // Poll every 2 s while generating
  useEffect(() => {
    if (tournament?.status !== "generating") return;
    const interval = setInterval(fetchTournament, 2000);
    return () => clearInterval(interval);
  }, [tournament?.status, fetchTournament]);

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewUrl(null);
    const res = await fetch(`/api/tournaments/${id}/preview`);
    if (res.ok) {
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
      const name = res.headers.get("X-Recipient-Name");
      setPreviewName(name ? decodeURIComponent(name) : "");
      await fetchTournament(); // pick up status = "previewed"
    } else {
      const body = await res.json().catch(() => ({}));
      setPreviewError(body.error || "Preview failed — check your field configuration.");
    }
    setPreviewLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError("");
    const res = await fetch(`/api/tournaments/${id}/generate`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setGenerateError(body.error || "Generation failed.");
    }
    setGenerating(false);
    await fetchTournament();
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

  const status = tournament.status;
  const isReady = status === "ready";
  const isGenerating = status === "generating";
  const isPreviewed = status === "previewed";
  const isDraft = status === "draft";

  const progress = tournament.progress;
  const progressPct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const filtered = tournament.certificates.filter((c) =>
    c.recipientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[status]}`}>
            {status}
          </span>
        </div>
      </div>

      {/* ── Step flow (only shown before ready) ── */}
      {!isReady && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">

          {/* Step indicators */}
          <div className="flex items-center gap-6 mb-6 pb-5 border-b border-gray-100">
            <Step n={1} label="Preview Sample" active={isDraft} done={isPreviewed || isGenerating || isReady} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={2} label="Approve & Generate" active={isPreviewed} done={isGenerating || isReady} />
            <div className="flex-1 h-px bg-gray-200" />
            <Step n={3} label="Done" active={isGenerating} done={isReady} />
          </div>

          {/* Step 1 – Preview */}
          {(isDraft || isPreviewed) && (
            <div className="mb-5">
              <h2 className="font-semibold text-gray-900 mb-1">Step 1 — Preview a sample certificate</h2>
              <p className="text-sm text-gray-500 mb-3">
                We'll render the certificate for the participant with the longest name — the hardest case to fit.
                Check that the text is positioned correctly before generating all {" "}
                {tournament.certificates.length > 0 ? tournament.certificates.length : ""} certificates.
              </p>
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="px-5 py-2 border border-brand-500 text-brand-500 hover:bg-brand-50 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {previewLoading
                  ? "Rendering preview…"
                  : previewUrl
                  ? "Re-render Preview"
                  : "Generate Preview"}
              </button>
              {previewError && (
                <p className="text-red-600 text-sm mt-2">{previewError}</p>
              )}
            </div>
          )}

          {/* Preview image */}
          {previewUrl && (
            <div className="mb-5 rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Sample for: <strong className="text-gray-700">{previewName || "longest name"}</strong>
                </p>
                <a href={previewUrl} download="preview.png" className="text-xs text-blue-600 hover:underline">
                  Download preview
                </a>
              </div>
              <img src={previewUrl} alt="Certificate preview" className="w-full" />
            </div>
          )}

          {/* Step 2 – Approve & Generate */}
          {isPreviewed && !isGenerating && (
            <div className="border-t border-gray-100 pt-5">
              <h2 className="font-semibold text-gray-900 mb-1">Step 2 — Approve &amp; generate all certificates</h2>
              <p className="text-sm text-gray-500 mb-3">
                Does the preview look correct? Click below to render every certificate and upload them to Google Drive.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setPreviewUrl(null); fetchTournament(); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Redo Preview
                </button>
                <button
                  onClick={handleGenerate}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                >
                  ✓ Looks Good — Generate All
                </button>
              </div>
              {generateError && (
                <p className="text-red-600 text-sm mt-2">{generateError}</p>
              )}
            </div>
          )}

          {/* Step 3 – Progress */}
          {isGenerating && (
            <div className="border-t border-gray-100 pt-5">
              <h2 className="font-semibold text-gray-900 mb-3">Generating certificates…</h2>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className="bg-brand-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span className="animate-pulse">Uploading to Google Drive…</span>
                {progress && progress.total > 0 && (
                  <span className="font-medium text-gray-700">
                    {progress.current} / {progress.total}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {status === "error" && tournament.errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
          <strong>Error:</strong> {tournament.errorMessage}
          <button
            onClick={() => { fetchTournament(); }}
            className="ml-4 underline text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Drive folder link */}
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
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors shrink-0 ml-4"
          >
            Open Folder ↗
          </a>
        </div>
      )}

      {/* Certificates table */}
      {tournament.certificates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-900 shrink-0">
              Certificates
              <span className="ml-2 text-sm font-normal text-gray-400">
                {isGenerating
                  ? `${tournament.certificates.length} uploaded so far`
                  : `${tournament.certificates.length} total`}
              </span>
            </h2>
            <input
              type="text"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-6 py-3 w-12">#</th>
                  <th className="text-left px-6 py-3">Recipient</th>
                  <th className="text-left px-6 py-3">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((cert, i) => (
                  <tr key={cert.driveFileId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{cert.recipientName}</td>
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
          {searchQuery && filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">No results for "{searchQuery}"</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && tournament.certificates.length === 0 && status !== "error" && !isDraft && !isPreviewed && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📜</p>
          <p className="font-medium">No certificates yet.</p>
        </div>
      )}
    </div>
  );
}
