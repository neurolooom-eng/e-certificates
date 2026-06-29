/**
 * Storage layer.
 *
 * Local dev  → local filesystem (data/tournaments.json, uploads/<id>/).
 * Vercel     → Google Drive, one JSON file per tournament.
 *              Template image + xlsx are base64-embedded in the tournament
 *              file so creation is a single Drive write — no separate uploads.
 *
 * Drive structure:
 *   e-certificates/index.json        → [{id, name, eventDate, status, createdAt}]
 *   e-certificates/t-<id>.json       → full Tournament (with base64 files)
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

// ── Drive helpers ──────────────────────────────────────────────────────────

const INDEX_NAME = "e-certificates-index.json";

async function driveClient() {
  const { google } = await import("googleapis");
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function driveReadJson<T>(fileName: string): Promise<T | null> {
  const drive = await driveClient();
  const list = await drive.files.list({
    q: `name='${fileName}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  const file = list.data.files?.[0];
  if (!file?.id) return null;
  const res = await drive.files.get({ fileId: file.id, alt: "media" }, { responseType: "json" });
  return res.data as T;
}

async function driveWriteJson(fileName: string, data: unknown) {
  const { Readable } = await import("stream");
  const drive = await driveClient();
  const body = JSON.stringify(data);
  const stream = Readable.from(Buffer.from(body));

  const list = await drive.files.list({
    q: `name='${fileName}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  const existing = list.data.files?.[0];

  if (existing?.id) {
    await drive.files.update({
      fileId: existing.id,
      media: { mimeType: "application/json", body: stream },
    });
  } else {
    await drive.files.create({
      requestBody: { name: fileName },
      media: { mimeType: "application/json", body: stream },
      fields: "id",
    });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function readTournaments(): Promise<Tournament[]> {
  if (!IS_VERCEL) return readLocal();
  const index = await driveReadJson<Tournament[]>(INDEX_NAME);
  return index ?? [];
}

export async function getTournament(id: string): Promise<Tournament | null> {
  if (!IS_VERCEL) return readLocal().find((t) => t.id === id) ?? null;
  const t = await driveReadJson<Tournament>(`e-cert-t-${id}.json`);
  return t ?? null;
}

export async function saveTournament(tournament: Tournament) {
  if (!IS_VERCEL) {
    const all = readLocal();
    const idx = all.findIndex((t) => t.id === tournament.id);
    if (idx >= 0) all[idx] = tournament; else all.push(tournament);
    writeLocal(all);
    return;
  }

  // Write full tournament (with embedded files) to its own Drive file
  await driveWriteJson(`e-cert-t-${tournament.id}.json`, tournament);

  // Update the lightweight index so the list page loads fast
  const index = (await driveReadJson<Tournament[]>(INDEX_NAME)) ?? [];
  // Store only a lightweight summary in the index (no embedded files)
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
  await driveWriteJson(INDEX_NAME, index);
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
