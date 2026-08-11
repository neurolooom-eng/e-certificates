import { NextResponse } from "next/server";
import { getTournament, saveTournament, deleteTournament } from "@/lib/storage";
import { canAccess } from "@/lib/access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccess(tournament))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(tournament);
}

/** Archive / unarchive (soft delete) — body: { archived: boolean } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccess(tournament))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.archived === "boolean") tournament.archived = body.archived;

  try {
    await saveTournament(tournament);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ id, archived: tournament.archived });
}

/** Permanently delete the tournament and all its certificates. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await deleteTournament(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to delete: ${msg}` }, { status: 500 });
  }
  return NextResponse.json({ id, deleted: true });
}
