import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "./auth-options";
import { envAdmin } from "./users";
import type { Tournament } from "./types";

/**
 * Admin check. The role claim is authoritative, but fall back to the built-in
 * admin username so a session minted before roles existed — or any future
 * gap in claims — can't lock the administrator out of their own tournaments.
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  if (session.user.role === "admin") return true;
  const admin = envAdmin().username.toLowerCase();
  return (
    session.user.username?.toLowerCase() === admin ||
    session.user.name?.toLowerCase() === admin
  );
}

/** Tournaments an account may see: everything for admins, own for organisers. */
export function visibleTo(tournaments: Tournament[], session: Session | null): Tournament[] {
  // Admins see every tournament, including ones with no owner recorded —
  // those predate accounts and would otherwise belong to nobody.
  if (isAdmin(session)) return tournaments;
  if (!session?.user?.id) return [];
  return tournaments.filter((t) => t.ownerId === session.user.id);
}

/**
 * Admins may act on any tournament; an organiser only on their own.
 * Unowned tournaments stay admin-only rather than becoming everyone's.
 */
export async function canAccess(tournament: Tournament): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  if (isAdmin(session)) return true;
  return !!tournament.ownerId && tournament.ownerId === session.user.id;
}
