import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAdmin } from "@/lib/access";
import { listAcademies, listMemberships, createAcademy, membershipsOf } from "@/lib/academies";
import { listUsers } from "@/lib/users";

/**
 * Academies visible to the caller: all of them for an admin, otherwise only
 * the ones they belong to. Each carries the caller's role, so the UI can show
 * an owner their academy's tournaments without a second request.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const academies = await listAcademies();

  if (isAdmin(session)) {
    const memberships = await listMemberships();
    const users = await listUsers();
    return NextResponse.json({
      admin: true,
      academies: academies.map((a) => ({
        ...a,
        role: "owner",
        members: memberships
          .filter((m) => m.academyId === a.id)
          .map((m) => ({
            ...m,
            name: users.find((u) => u.id === m.userId)?.name ?? "Unknown",
            username: users.find((u) => u.id === m.userId)?.username ?? "",
          })),
      })),
    });
  }

  const mine = await membershipsOf(session.user.id!);
  return NextResponse.json({
    admin: false,
    academies: academies
      .filter((a) => mine.some((m) => m.academyId === a.id))
      .map((a) => ({ ...a, role: mine.find((m) => m.academyId === a.id)!.role })),
  });
}

/** Admin only: create an academy and name its owners. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const ownerIds: string[] = Array.isArray(body.ownerIds) ? body.ownerIds : [];
  const { academy, error } = await createAcademy(body.name, ownerIds);
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({ academy }, { status: 201 });
}
