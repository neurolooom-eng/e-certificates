import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { listUsers, createUser, type UserRole } from "@/lib/users";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "admin";
}

/** Admin only: the account list, including everyone awaiting approval. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return NextResponse.json(await listUsers());
}

/**
 * Admin only: create an account directly, skipping sign-up and approval.
 * For organisers who shouldn't have to wait on the request-and-approve round
 * trip — the admin sets the password and hands it over.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { username, password, name, email, organisation, role } = body;
  if (!username || !password || !name) {
    return NextResponse.json({ error: "Username, password and name are required." }, { status: 400 });
  }

  const { user, error } = await createUser({
    username,
    password,
    name,
    email,
    organisation,
    role: role === "admin" ? "admin" : ("organiser" as UserRole),
    // Created by an admin, so it is approved by definition
    status: "approved",
  });
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({ user }, { status: 201 });
}
