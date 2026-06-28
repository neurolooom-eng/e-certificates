/**
 * Storage layer.
 * Local dev  → local filesystem (data/tournaments.json, uploads/<id>/).
 * Vercel     → Google Drive for both tournament metadata and uploaded files.
 *              No extra services needed beyond what's already required.
 */
import fs from "fs";
import path from "path";
import type { Tournament } from "./types";

const IS_VERCEL = !!process.env.VERCEL;
const LOCAL_DATA_FILE = path.join(process.cwd(), "data", "tournaments.json");
// Google Drive file ID for the tournaments manifest — cached after first lookup
let _manifestFileId: string | null = null;

// ── helpers ────────────────────────────────────────────────────────────────

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ── local filesystem (dev) ─────────────────────────────────────────────────

function readLocal(): Tournament[] {
  ensureDir(path.dirname(LOCAL_DATA_FILE));
  if (!fs.existsSync(LOCAL_DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf-8")); } catch { return []; }
}

function writeLocal(t: Tournament[]) {
  ensureDir(path.dirname(LOCAL_DATA_FILE));
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(t, null, 2));
}

// ── Google Drive manifest (Vercel) ─────────────────────────────────────────

async function getManifestFileId(): Promise<string | null> {
  if (_manifestFileId) return _manifestFileId;
  const { google } = await import("googleapis");
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!creds) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });
  const list = await drive.files.list({
    q: "name='tournaments.json' and trashed=false and mimeType='application/json'",
    fields: "files(id)",
    spaces: "drive",
  });
  if (list.data.files?.length) {
    _manifestFileId = list.data.files[0].id!;
  }
  return _manifestFileId;
}

async function readDrive(): Promise<Tournament[]> {
  try {
    const fileId = await getManifestFileId();
    if (!fileId) return [];
    const res = await fetch(`https://drive.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: await getDriveAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function writeDrive(tournaments: Tournament[]) {
  const { google } = await import("googleapis");
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });
  const body = JSON.stringify(tournaments, null, 2);
  const { Readable } = await import("stream");

  const existingId = await getManifestFileId();
  if (existingId) {
    await drive.files.update({
      fileId: existingId,
      media: { mimeType: "application/json", body: Readable.from(Buffer.from(body)) },
    });
  } else {
    const res = await drive.files.create({
      requestBody: { name: "tournaments.json" },
      media: { mimeType: "application/json", body: Readable.from(Buffer.from(body)) },
      fields: "id",
    });
    _manifestFileId = res.data.id!;
  }
}

async function getDriveAuthHeader(): Promise<Record<string, string>> {
  const { google } = await import("googleapis");
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const client = await auth.getClient();
  const token = await (client as { getAccessToken: () => Promise<{ token: string }> }).getAccessToken();
  return { Authorization: `Bearer ${token.token}` };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function readTournaments(): Promise<Tournament[]> {
  return IS_VERCEL ? readDrive() : readLocal();
}

export async function getTournament(id: string): Promise<Tournament | null> {
  return (await readTournaments()).find((t) => t.id === id) ?? null;
}

export async function saveTournament(tournament: Tournament) {
  const all = await readTournaments();
  const idx = all.findIndex((t) => t.id === tournament.id);
  if (idx >= 0) all[idx] = tournament; else all.push(tournament);
  if (IS_VERCEL) await writeDrive(all); else writeLocal(all);
}

// ── Local uploads (dev only) ───────────────────────────────────────────────

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

export async function readUploadedFile(location: string): Promise<Buffer> {
  if (location.startsWith("http")) {
    // Google Drive download URL — needs auth header from service account
    const headers = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? await getDriveAuthHeader()
      : {};
    const res = await fetch(location, { headers });
    if (!res.ok) throw new Error(`Failed to fetch file (${res.status}): ${location}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(location);
}
