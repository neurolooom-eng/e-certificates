import { NextResponse } from "next/server";
import { getTournament, saveTournament } from "@/lib/storage";
import { canAccess } from "@/lib/access";

/**
 * Pause / resume / stop a generation run.
 *
 * The run itself is a long-lived request, so control is cooperative: this
 * endpoint only writes a flag, and the generation loop checks it between
 * certificates and winds itself down. Resuming starts a fresh run that skips
 * whatever was already uploaded.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccess(tournament))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { action } = await request.json().catch(() => ({ action: "" }));

  switch (action) {
    case "pause":
      tournament.generationControl = "pause";
      break;

    case "stop":
      tournament.generationControl = "stop";
      break;

    case "resume":
      // Clear the flag here so the loop the client is about to start doesn't
      // immediately see a stale pause and exit.
      tournament.generationControl = "run";
      tournament.status = "generating";
      break;

    default:
      return NextResponse.json({ error: "action must be pause, resume or stop" }, { status: 400 });
  }

  await saveTournament(tournament);
  return NextResponse.json({ id, action, status: tournament.status });
}
