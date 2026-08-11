import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { listUsers } from "@/lib/users";

/** Admin only: the account list, including everyone awaiting approval. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return NextResponse.json(await listUsers());
}
