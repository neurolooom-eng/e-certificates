import fs from "fs";
import path from "path";
import { put, head, del } from "@vercel/blob";
import type { Tournament } from "./types";

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DATA_FILE = path.join(process.cwd(), "data", "tournaments.json");
const BLOB_MANIFEST_KEY = "e-certificates/tournaments.json";

// ── Local helpers ──────────────────────────────────────────────────────────

function ensureLocalDir() {
  const dir = path.dirname(LOCAL_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLocal(): Tournament[] {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf-8")); } catch { return []; }
}

function writeLocal(t: Tournament[]) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(t, null, 2));
}

// ── Blob helpers ───────────────────────────────────────────────────────────

async function readBlob(): Promise<Tournament[]> {
  try {
    const blob = await head(BLOB_MANIFEST_KEY);
    const res = await fetch(blob.url);
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

async function writeBlob(tournaments: Tournament[]) {
  await put(BLOB_MANIFEST_KEY, JSON.stringify(tournaments, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function readTournaments(): Promise<Tournament[]> {
  return USE_BLOB ? readBlob() : readLocal();
}

export async function saveTournament(tournament: Tournament) {
  const all = await readTournaments();
  const idx = all.findIndex((t) => t.id === tournament.id);
  if (idx >= 0) all[idx] = tournament;
  else all.push(tournament);
  if (USE_BLOB) await writeBlob(all);
  else writeLocal(all);
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const all = await readTournaments();
  return all.find((t) => t.id === id) ?? null;
}

// ── File uploads ───────────────────────────────────────────────────────────

export async function saveUploadedFile(
  data: Buffer,
  tournamentId: string,
  filename: string
): Promise<string> {
  if (USE_BLOB) {
    const blob = await put(`e-certificates/uploads/${tournamentId}/${filename}`, data, {
      access: "public",
      addRandomSuffix: false,
    });
    return blob.url;
  }
  const dir = path.join(process.cwd(), "uploads", tournamentId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, data);
  return filePath;
}

export async function readUploadedFile(location: string): Promise<Buffer> {
  if (location.startsWith("http")) {
    const res = await fetch(location);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(location);
}

export function getLocalTmpDir(id: string) {
  const dir = path.join("/tmp", "e-cert", id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
