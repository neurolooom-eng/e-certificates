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
import {
  isR2Configured, r2Put, r2GetBuffer, r2GetStream, r2List, r2DeletePrefix, r2Href, keyFromHref,
} from "./r2";

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

/**
 * Writes use only options the store is guaranteed to accept. Anything it
 * rejects would throw on every save, and freshness is handled on the read
 * side instead — the UI no longer depends on a status round-tripping back
 * instantly.
 */
async function blobPut(pathname: string, data: string | Buffer, contentType = "application/json") {
  if (isR2Configured()) {
    await r2Put(pathname, Buffer.isBuffer(data) ? data : Buffer.from(data), contentType);
    return;
  }
  const { put } = await import("@vercel/blob");
  await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Read a blob's contents.
 *
 * Object URLs answer 403 on this store — for both anonymous requests and ones
 * carrying the token as a bearer header, because that isn't how blob auth
 * works. The SDK's `get` is the supported read path: it resolves the object
 * from the store using the token. Try public first, then private, since which
 * one applies is a property of the store rather than of this code.
 */
export interface BlobContent {
  stream: ReadableStream<Uint8Array> | null;
  contentType: string | null;
}

export async function fetchBlob(urlOrPathname: string): Promise<BlobContent | null> {
  if (isR2Configured()) {
    const key = keyFromHref(urlOrPathname) ?? urlOrPathname;
    return r2GetStream(key);
  }

  const { get } = await import("@vercel/blob");

  for (const access of ["public", "private"] as const) {
    try {
      const result = await get(urlOrPathname, { access });
      if (result?.statusCode === 200 && result.stream) {
        return {
          stream: result.stream,
          contentType: result.headers?.get?.("content-type") ?? null,
        };
      }
    } catch {
      // Try the other access mode before giving up
    }
  }
  return null;
}

/** Read a blob as text, or null when it can't be read. */
async function blobText(urlOrPathname: string): Promise<string | null> {
  const content = await fetchBlob(urlOrPathname);
  if (!content?.stream) return null;
  try {
    return await new Response(content.stream).text();
  } catch {
    return null;
  }
}

async function blobGet<T>(pathname: string): Promise<T | null> {
  if (isR2Configured()) {
    const buf = await r2GetBuffer(pathname);
    if (!buf) return null;
    try { return JSON.parse(buf.toString("utf-8")) as T; } catch { return null; }
  }

  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: pathname });
    if (blobs.length === 0) return null;

    // Prefer an exact match, but a lone prefix hit is the same object — never
    // report a record as missing over an equality quirk in the pathname.
    const match = blobs.find((b) => b.pathname === pathname) ?? (blobs.length === 1 ? blobs[0] : null);
    if (!match) return null;

    // Never decorate the URL: anything the store rejects turns a live record
    // into a silent null, which reads as "everything disappeared".
    const text = await blobText(match.url);
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Read/write an arbitrary JSON document through whichever backend is active.
 * Anything that persists state must go through here — writing to a specific
 * store directly is how the user records ended up stranded in a quota-blocked
 * Blob store while everything else had moved to R2.
 */
export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  if (!IS_VERCEL && !isR2Configured()) {
    const file = path.join(process.cwd(), "data", pathname.replace(/\//g, "-"));
    if (!fs.existsSync(file)) return fallback;
    try { return JSON.parse(fs.readFileSync(file, "utf-8")) as T; } catch { return fallback; }
  }
  return (await blobGet<T>(pathname)) ?? fallback;
}

export async function writeJson(pathname: string, value: unknown): Promise<void> {
  if (!IS_VERCEL && !isR2Configured()) {
    const file = path.join(process.cwd(), "data", pathname.replace(/\//g, "-"));
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    return;
  }
  await blobPut(pathname, JSON.stringify(value));
}

export async function blobUploadBuffer(
  buffer: Buffer,
  pathname: string,
  contentType: string
): Promise<string> {
  // Local dev without a store — serve generated certificates from /public
  // so the whole flow (including the share page) works offline.
  if (!IS_VERCEL && !isR2Configured()) {
    const file = path.join(process.cwd(), "public", "generated", pathname);
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, buffer);
    return `/generated/${encodeURI(pathname)}`;
  }

  if (isR2Configured()) return r2Put(pathname, buffer, contentType);

  const { put } = await import("@vercel/blob");
  const { url } = await put(pathname, buffer, { access: "public", contentType, addRandomSuffix: false });
  return url;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** The lightweight record kept in the index — no embedded files. */
function summarise(t: Tournament): Tournament {
  return {
    id: t.id,
    name: t.name,
    eventDate: t.eventDate,
    createdAt: t.createdAt,
    status: t.status,
    templatePath: "",
    dataPath: "",
    config: t.config,
    certificates: t.certificates.map(({ recipientName, driveLink, driveFileId, rowIndex, generatedAt, category, rank }) => ({
      recipientName, driveLink, driveFileId, rowIndex, generatedAt, category, rank,
    })),
    driveFolderLink: t.driveFolderLink,
    progress: t.progress,
    eventType: t.eventType,
    archived: t.archived,
    generationControl: t.generationControl,
    ownerId: t.ownerId,
    ownerName: t.ownerName,
  };
}

/**
 * Rebuild the index from the per-tournament records, which are the source of
 * truth. The index is a derived cache, so a damaged or missing one must never
 * mean the tournaments are gone.
 */
async function rebuildIndex(): Promise<Tournament[]> {
  const records = isR2Configured()
    ? (await r2List("tournaments/")).filter((k) => k.endsWith("/tournament.json"))
    : (await (await import("@vercel/blob")).list({ prefix: "tournaments/" })).blobs
        .filter((b) => b.pathname.endsWith("/tournament.json"))
        .map((b) => b.url);

  const recovered: Tournament[] = [];
  for (const record of records) {
    try {
      const text = await blobText(record);
      if (!text) continue;
      recovered.push(summarise(JSON.parse(text) as Tournament));
    } catch {
      // Skip anything unreadable rather than failing the whole rebuild
    }
  }

  if (recovered.length > 0) {
    await blobPut("tournaments/index.json", JSON.stringify(recovered));
  }
  return recovered;
}

export async function readTournaments(): Promise<Tournament[]> {
  if (!IS_VERCEL) return readLocal();
  const index = await blobGet<Tournament[]>("tournaments/index.json");
  if (index && index.length > 0) return index;
  return rebuildIndex();
}

export async function getTournament(id: string): Promise<Tournament | null> {
  if (!IS_VERCEL) return readLocal().find((t) => t.id === id) ?? null;

  const full = await blobGet<Tournament>(`tournaments/${id}/tournament.json`);
  if (full) return full;

  // Fall back to the index entry. It carries the name, date and certificate
  // links — enough to keep the share page and the list working even if the
  // full record can't be read. Only generation needs the embedded files.
  const index = (await blobGet<Tournament[]>("tournaments/index.json")) ?? [];
  return index.find((t) => t.id === id) ?? null;
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

  // Update the lightweight index so the list page loads fast. The index is
  // derived data — if it can't be read, rebuild it from the per-tournament
  // records rather than replacing it with a single-entry list.
  let index = await blobGet<Tournament[]>("tournaments/index.json");
  if (!index || index.length === 0) index = await rebuildIndex();

  const summary = summarise(tournament);
  const i = index.findIndex((t) => t.id === tournament.id);
  if (i >= 0) index[i] = summary; else index.push(summary);
  await blobPut("tournaments/index.json", JSON.stringify(index));
}

/**
 * Permanently delete a tournament: its metadata, uploaded files, and every
 * generated certificate. Also removes it from the index.
 */
export async function deleteTournament(id: string): Promise<boolean> {
  if (!IS_VERCEL) {
    const all = readLocal();
    const next = all.filter((t) => t.id !== id);
    if (next.length === all.length) return false;
    writeLocal(next);
    const dir = path.join(process.cwd(), "uploads", id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  if (isR2Configured()) {
    await r2DeletePrefix(`tournaments/${id}/`);
    const index = (await blobGet<Tournament[]>("tournaments/index.json")) ?? [];
    const next = index.filter((t) => t.id !== id);
    await blobPut("tournaments/index.json", JSON.stringify(next));
    return true;
  }

  const { list, del } = await import("@vercel/blob");

  // Delete every blob under this tournament's prefix (metadata + certificates)
  const { blobs } = await list({ prefix: `tournaments/${id}/` });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));

  // Remove from the index
  const index = (await blobGet<Tournament[]>("tournaments/index.json")) ?? [];
  const next = index.filter((t) => t.id !== id);
  await blobPut("tournaments/index.json", JSON.stringify(next));

  return blobs.length > 0 || next.length !== index.length;
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
    // Object URLs aren't directly fetchable on this store — go through the SDK
    const content = await fetchBlob(location);
    if (!content?.stream) throw new Error("Could not read the uploaded file from storage.");
    return Buffer.from(await new Response(content.stream).arrayBuffer());
  }
  return fs.readFileSync(location);
}

/**
 * Store an uploaded source file (certificate template, participant list).
 *
 * These are kept as their own objects rather than embedded in the tournament
 * record: the record is rewritten on every progress update, and carrying a
 * few hundred KB of base64 through each of those writes burns storage quota
 * enormously for no benefit.
 */
export async function saveSourceFile(
  buffer: Buffer,
  tournamentId: string,
  filename: string,
  contentType: string
): Promise<string> {
  if (!IS_VERCEL && !isR2Configured()) return saveUploadedFile(buffer, tournamentId, filename);

  const key = `tournaments/${tournamentId}/source/${filename}`;
  if (isR2Configured()) return r2Put(key, buffer, contentType);

  const { put } = await import("@vercel/blob");
  const { url } = await put(key, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}
