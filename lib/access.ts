import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import type { Tournament } from "./types";

/**
 * Admins may act on any tournament; an organiser only on their own.
 * Tournaments created before accounts existed have no owner, so they stay
 * admin-only rather than becoming everyone's.
 */
export async function canAccess(tournament: Tournament): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  if (session.user.role === "admin") return true;
  return !!tournament.ownerId && tournament.ownerId === session.user.id;
}
