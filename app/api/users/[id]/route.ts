import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { deleteUser, setUserStatus, setPassword, type UserStatus } from "@/lib/users";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "admin";
}

/** Admin only: approve or reject a sign-up. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Password reset. Existing passwords can't be revealed — they're stored as
  // one-way hashes — so the admin sets a new one and passes it on.
  if (typeof body.password === "string") {
    const { user, error } = await setPassword(id, body.password);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(user);
  }

  const status = body.status as UserStatus;

  if (!["pending", "approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "status must be pending, approved or rejected" }, { status: 400 });
  }

  const user = await setUserStatus(id, status);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

/** Admin only: remove an account. Their tournaments are left untouched. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;
  const deleted = await deleteUser(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id, deleted: true });
}
