import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readTournaments, saveTournament, saveUploadedFile } from "@/lib/storage";
import type { Tournament, TournamentConfig } from "@/lib/types";

export const maxDuration = 60;

const IS_VERCEL = !!process.env.VERCEL;

export async function GET() {
  const tournaments = await readTournaments();
  return NextResponse.json(tournaments);
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const eventDate = formData.get("eventDate") as string;
  const templateFile = formData.get("template") as File;
  const dataFile = formData.get("data") as File;
  const configJson = formData.get("config") as string;

  if (!name || !templateFile || !dataFile || !configJson) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = uuidv4();
  const config: TournamentConfig = JSON.parse(configJson);

  const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
  const dataBuffer = Buffer.from(await dataFile.arrayBuffer());
  const templateExt = templateFile.name.split(".").pop() || "jpg";
  const dataExt = dataFile.name.split(".").pop() || "xlsx";

  let templatePath: string;
  let dataPath: string;

  if (IS_VERCEL) {
    // Embed files as base64 directly in the tournament record.
    // A single Drive write replaces 4–5 separate API calls → much faster.
    templatePath = `base64:${templateBuffer.toString("base64")}`;
    dataPath = `base64:${dataBuffer.toString("base64")}`;
  } else {
    [templatePath, dataPath] = await Promise.all([
      saveUploadedFile(templateBuffer, id, `template.${templateExt}`),
      saveUploadedFile(dataBuffer, id, `data.${dataExt}`),
    ]);
  }

  const tournament: Tournament = {
    id,
    name,
    eventDate: eventDate || new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    status: "draft",
    templatePath,
    dataPath,
    config,
    certificates: [],
  };

  try {
    await saveTournament(tournament);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("saveTournament failed:", msg);
    return NextResponse.json({ error: `Failed to save tournament: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ id: tournament.id, name: tournament.name, status: tournament.status }, { status: 201 });
}
