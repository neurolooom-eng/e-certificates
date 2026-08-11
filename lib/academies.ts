/**
 * Academies.
 *
 * A user can belong to several academies, and their role is a property of the
 * membership rather than of the user — the same person can own one academy
 * and merely run tournaments for another.
 *
 * Visibility follows from that: a member sees the tournaments they created,
 * an owner sees everything created under their academy, and an admin sees
 * everything everywhere.
 */
import crypto from "crypto";
import { readJson, writeJson } from "./storage";

const STORE_PATH = "academies/index.json";

export type AcademyRole = "owner" | "member";

export interface Academy {
  id: string;
  name: string;
  createdAt: string;
}

export interface Membership {
  academyId: string;
  userId: string;
  role: AcademyRole;
  addedAt: string;
}

interface Store {
  academies: Academy[];
  memberships: Membership[];
}

async function read(): Promise<Store> {
  const data = await readJson<Partial<Store>>(STORE_PATH, {});
  return { academies: data.academies ?? [], memberships: data.memberships ?? [] };
}

async function write(store: Store): Promise<void> {
  await writeJson(STORE_PATH, store);
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listAcademies(): Promise<Academy[]> {
  return (await read()).academies;
}

export async function listMemberships(): Promise<Membership[]> {
  return (await read()).memberships;
}

export async function getAcademy(id: string): Promise<Academy | null> {
  return (await read()).academies.find((a) => a.id === id) ?? null;
}

/** Every membership held by one user, across academies. */
export async function membershipsOf(userId: string): Promise<Membership[]> {
  if (!userId) return [];
  return (await read()).memberships.filter((m) => m.userId === userId);
}

/** Members of one academy, owners included. */
export async function membersOf(academyId: string): Promise<Membership[]> {
  return (await read()).memberships.filter((m) => m.academyId === academyId);
}

/** Academies where this user is an owner — the ones whose tournaments they see in full. */
export async function ownedAcademyIds(userId: string): Promise<string[]> {
  return (await membershipsOf(userId)).filter((m) => m.role === "owner").map((m) => m.academyId);
}

export async function isMember(userId: string, academyId: string): Promise<boolean> {
  return (await membershipsOf(userId)).some((m) => m.academyId === academyId);
}

export async function isOwnerOf(userId: string, academyId: string): Promise<boolean> {
  return (await membershipsOf(userId)).some((m) => m.academyId === academyId && m.role === "owner");
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** Admin only. An academy with no owner is useless, so one is named up front. */
export async function createAcademy(
  name: string,
  ownerUserIds: string[]
): Promise<{ academy?: Academy; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Please give the academy a name." };

  const store = await read();
  if (store.academies.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "An academy with that name already exists." };
  }

  const academy: Academy = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  store.academies.push(academy);

  for (const userId of ownerUserIds.filter(Boolean)) {
    store.memberships.push({
      academyId: academy.id,
      userId,
      role: "owner",
      addedAt: new Date().toISOString(),
    });
  }

  await write(store);
  return { academy };
}

/**
 * Add someone, or change the role they already hold. An academy may have
 * several owners, so promoting one never displaces another.
 */
export async function setMembership(
  academyId: string,
  userId: string,
  role: AcademyRole
): Promise<{ membership?: Membership; error?: string }> {
  const store = await read();
  if (!store.academies.some((a) => a.id === academyId)) {
    return { error: "That academy no longer exists." };
  }

  const existing = store.memberships.find((m) => m.academyId === academyId && m.userId === userId);
  if (existing) {
    existing.role = role;
    await write(store);
    return { membership: existing };
  }

  const membership: Membership = {
    academyId,
    userId,
    role,
    addedAt: new Date().toISOString(),
  };
  store.memberships.push(membership);
  await write(store);
  return { membership };
}

export async function removeMembership(academyId: string, userId: string): Promise<boolean> {
  const store = await read();
  const before = store.memberships.length;
  store.memberships = store.memberships.filter(
    (m) => !(m.academyId === academyId && m.userId === userId)
  );
  if (store.memberships.length === before) return false;
  await write(store);
  return true;
}

/**
 * Delete an academy and its memberships. Tournaments run under it are left
 * alone — they keep their creator, so they simply stop being visible to the
 * academy's owners rather than disappearing.
 */
export async function deleteAcademy(id: string): Promise<boolean> {
  const store = await read();
  const before = store.academies.length;
  store.academies = store.academies.filter((a) => a.id !== id);
  if (store.academies.length === before) return false;
  store.memberships = store.memberships.filter((m) => m.academyId !== id);
  await write(store);
  return true;
}
