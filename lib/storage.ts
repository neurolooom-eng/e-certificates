/**
 * Storage layer.
 *
 * Local dev  → local filesystem (data/tournaments.json, uploads/<id>/).
 * Vercel     → Vercel Blob for all files (JSON metadata + certificate PNGs).
 *
 * Blob structure:
 *   tournaments/index.json          → lightweight Tournament[] list
 *   tournaments/<id>/tournament.json → full Tournament (with base64 files)
 *   tournaments/<id>/certs/<file>   → generated certificate PNGs
 */
import fs from "fs";
import path from "path";
import type { Tournament } from "./types";

const IS_VERCEL = !!process.env.VERCEL;

// ── Local helpers ──────────────────────────────────────────────────────────

const LOCAL_DATA = path.join(process.cwd(), "data", "tournaments.json");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readLocal(): Tournament[] {
  ensureDir(path.dirname(LOCAL_DATA));
  if (!fs.existsSync(LOCAL_DATA)) return [];
  try { return JSON.parse(fs.readFileSync(LOCAL_DATA, "utf-8")); } catch { return []; }
}

function writeLocal(t: Tournament[]) {
  ensureDir(path.dirname(LOCAL_DATA));
  fs.writeFileSync(LOCAL_DATA, JSON.stringify(t, null, 2));
}

// ── Blob helpers ───────────────────────────────────────────────────────────

async function blobPut(pathname: string, data: string | Buffer, contentType = "application/json") {
  const { put } = await import("@vercel/blob");
  await put(pathname, data, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true });
}

async function blobGet<T>(pathname: string): Promise<T | null> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: pathname });
  const match = blobs.find((b) => b.pathname === pathname);
  if (!match) return null;
  const res = await fetch(match.url);
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export async function blobUploadBuffer(
  buffer: Buffer,
  pathname: string,
  contentType: string
): Promise<string> {
  const { put } = await import("@vercel/blob");
  const { url } = await put(pathname, buffer, { access: "public", contentType, addRandomSuffix: false });
  return url;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function readTournaments(): Promise<Tournament[]> {
  if (!IS_VERCEL) return readLocal();
  const index = await blobGet<Tournament[]>("tournaments/index.json");
  return index ?? [];
}

export async function getTournament(id: string): Promise<Tournament | null> {
  if (!IS_VERCEL) return readLocal().find((t) => t.id === id) ?? null;
  return blobGet<Tournament>(`tournaments/${id}/tournament.json`);
}

export async function saveTournament(tournament: Tournament) {
  if (!IS_VERCEL) {
    const all = readLocal();
    const idx = all.findIndex((t) => t.id === tournament.id);
    if (idx >= 0) all[idx] = tournament; else all.push(tournament);
    writeLocal(all);
    return;
  }

  // Write full tournament to its own Blob file
  await blobPut(
    `tournaments/${tournament.id}/tournament.json`,
    JSON.stringify(tournament)
  );

  // Update the lightweight index so the list page loads fast
  const index = (await blobGet<Tournament[]>("tournaments/index.json")) ?? [];
  const summary: Tournament = {
    id: tournament.id,
    name: tournament.name,
    eventDate: tournament.eventDate,
    createdAt: tournament.createdAt,
    status: tournament.status,
    templatePath: "",
    dataPath: "",
    config: tournament.config,
    certificates: tournament.certificates.map(({ recipientName, driveLink, driveFileId, rowIndex, generatedAt }) => ({
      recipientName, driveLink, driveFileId, rowIndex, generatedAt,
    })),
    driveFolderLink: tournament.driveFolderLink,
    progress: tournament.progress,
  };
  const i = index.findIndex((t) => t.id === tournament.id);
  if (i >= 0) index[i] = summary; else index.push(summary);
  await blobPut("tournaments/index.json", JSON.stringify(index));
}

// ── File storage ───────────────────────────────────────────────────────────

export function getUploadsDir(id: string): string {
  const dir = path.join(process.cwd(), "uploads", id);
  ensureDir(dir);
  return dir;
}

export async function saveUploadedFile(
  data: Buffer,
  tournamentId: string,
  filename: string
): Promise<string> {
  const dir = getUploadsDir(tournamentId);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, data);
  return filePath;
}

/**
 * Resolve a file location to a Buffer.
 * Supports: local path, http URL, or inline "base64:<data>" strings.
 */
export async function readUploadedFile(location: string): Promise<Buffer> {
  if (location.startsWith("base64:")) {
    return Buffer.from(location.slice(7), "base64");
  }
  if (location.startsWith("http")) {
    const res = await fetch(location);
    if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(location);
}
