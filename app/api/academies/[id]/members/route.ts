import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAdmin } from "@/lib/access";
import {
  membersOf, setMembership, removeMembership, isOwnerOf, getAcademy, type AcademyRole,
} from "@/lib/academies";
import { listUsers, findByUsername } from "@/lib/users";

/** Admins may manage any academy; owners only the ones they own. */
async function requireOwner(academyId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  if (isAdmin(session)) return true;
  return !!session.user.id && (await isOwnerOf(session.user.id, academyId));
}

/** The academy's members, with names attached for display. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireOwner(id))) {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }

  const users = await listUsers();
  const members = (await membersOf(id)).map((m) => ({
    ...m,
    name: users.find((u) => u.id === m.userId)?.name ?? "Unknown",
    username: users.find((u) => u.id === m.userId)?.username ?? "",
  }));
  return NextResponse.json(members);
}

/**
 * Add a member, or change the role of one already there. An academy can have
 * several owners, so promoting someone never displaces anyone.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireOwner(id))) {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }
  if (!(await getAcademy(id))) {
    return NextResponse.json({ error: "That academy no longer exists." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const role: AcademyRole = body?.role === "owner" ? "owner" : "member";

  // Admins pick from a list; owners name the account instead, so they never
  // receive a directory of every user on the system.
  let userId = body?.userId as string | undefined;
  if (!userId && body?.username) {
    const user = await findByUsername(String(body.username));
    if (!user) return NextResponse.json({ error: "No account with that username." }, { status: 404 });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: "Pick an account to add." }, { status: 400 });

  const { membership, error } = await setMembership(id, userId, role);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ membership }, { status: 201 });
}

/**
 * Remove someone from the academy. Their tournaments stay theirs — they
 * simply stop being visible to the academy's owners.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireOwner(id))) {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  // An academy with no owner can't be managed by anyone but an admin, so
  // refuse to remove the last one.
  const members = await membersOf(id);
  const owners = members.filter((m) => m.role === "owner");
  if (owners.length === 1 && owners[0].userId === userId) {
    return NextResponse.json(
      { error: "This is the academy's only owner. Add another owner first." },
      { status: 400 }
    );
  }

  const removed = await removeMembership(id, userId);
  if (!removed) return NextResponse.json({ error: "Not a member" }, { status: 404 });
  return NextResponse.json({ removed: true });
}
