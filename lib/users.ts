/**
 * User accounts.
 *
 * Anyone can sign up, but an account stays pending until an admin approves it.
 * Approved users see only the tournaments they created; admins see everything.
 *
 * Stored alongside tournaments — local JSON in dev, Vercel Blob in production.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const IS_VERCEL = !!process.env.VERCEL;
const BLOB_PATH = "users/index.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "users.json");

export type UserRole = "admin" | "organiser";
export type UserStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  organisation?: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  createdAt: string;
  approvedAt?: string;
}

/** Public shape — never leaks the password hash. */
export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(u: User): SafeUser {
  const { passwordHash: _ignored, ...safe } = u;
  return safe;
}

// ── Password hashing (scrypt — no native dependency) ──────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  // Constant-time compare so a wrong password can't be probed by timing
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Storage ────────────────────────────────────────────────────────────────

async function readAll(): Promise<User[]> {
  if (!IS_VERCEL) {
    if (!fs.existsSync(LOCAL_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf-8")); } catch { return []; }
  }
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: BLOB_PATH });
  const match = blobs.find((b) => b.pathname === BLOB_PATH);
  if (!match) return [];
  const res = await fetch(`${match.url}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return [];
  try { return (await res.json()) as User[]; } catch { return []; }
}

async function writeAll(users: User[]): Promise<void> {
  if (!IS_VERCEL) {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(users, null, 2));
    return;
  }
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(users), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

// ── API ────────────────────────────────────────────────────────────────────

/**
 * Every deployment has one built-in admin from env (ADMIN_USERNAME /
 * ADMIN_PASSWORD), so there is always a way in even before any account exists.
 */
export function envAdmin(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "123",
  };
}

export async function listUsers(): Promise<SafeUser[]> {
  return (await readAll()).map(toSafeUser);
}

export async function findByUsername(username: string): Promise<User | null> {
  const key = username.trim().toLowerCase();
  return (await readAll()).find((u) => u.username.toLowerCase() === key) ?? null;
}

export async function createUser(input: {
  username: string;
  password: string;
  name: string;
  email?: string;
  organisation?: string;
}): Promise<{ user?: SafeUser; error?: string }> {
  const username = input.username.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { error: "Username must be 3–32 characters: letters, numbers, dot, dash or underscore." };
  }
  if (input.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!input.name.trim()) {
    return { error: "Please enter your name." };
  }
  if (username === envAdmin().username.toLowerCase()) {
    return { error: "That username is reserved." };
  }

  const users = await readAll();
  if (users.some((u) => u.username.toLowerCase() === username)) {
    return { error: "That username is already taken." };
  }

  const user: User = {
    id: crypto.randomUUID(),
    username,
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    organisation: input.organisation?.trim() || undefined,
    role: "organiser",
    status: "pending",
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeAll(users);
  return { user: toSafeUser(user) };
}

export async function setUserStatus(id: string, status: UserStatus): Promise<SafeUser | null> {
  const users = await readAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.status = status;
  user.approvedAt = status === "approved" ? new Date().toISOString() : undefined;
  await writeAll(users);
  return toSafeUser(user);
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await readAll();
  const next = users.filter((u) => u.id !== id);
  if (next.length === users.length) return false;
  await writeAll(next);
  return true;
}
