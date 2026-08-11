import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "./auth-options";
import { envAdmin } from "./users";
import { ownedAcademyIds, isOwnerOf } from "./academies";
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

/**
 * Tournaments an account may see:
 *   admin  — everything, including tournaments with no owner recorded, which
 *            predate accounts and would otherwise belong to nobody;
 *   owner  — everything run under any academy they own, whoever created it;
 *   member — only what they created themselves.
 */
export async function visibleTo(
  tournaments: Tournament[],
  session: Session | null
): Promise<Tournament[]> {
  if (isAdmin(session)) return tournaments;
  const userId = session?.user?.id;
  if (!userId) return [];

  const owned = await ownedAcademyIds(userId);
  return tournaments.filter(
    (t) => t.ownerId === userId || (!!t.academyId && owned.includes(t.academyId))
  );
}

/**
 * Admins may act on any tournament, academy owners on anything run under an
 * academy they own, and everyone else only on their own. Unowned tournaments
 * stay admin-only rather than becoming everyone's.
 */
export async function canAccess(tournament: Tournament): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  if (isAdmin(session)) return true;

  const userId = session.user.id;
  if (!userId) return false;
  if (tournament.ownerId === userId) return true;
  return !!tournament.academyId && (await isOwnerOf(userId, tournament.academyId));
}
