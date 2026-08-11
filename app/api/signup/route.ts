import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";

/** Public: anyone can request an account. It stays pending until approved. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { username, password, name, email, organisation } = body;
  if (!username || !password || !name) {
    return NextResponse.json({ error: "Username, password and name are required." }, { status: 400 });
  }

  const { user, error } = await createUser({ username, password, name, email, organisation });
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({ user }, { status: 201 });
}
