import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readTournaments, saveTournament, saveUploadedFile } from "@/lib/storage";
import type { Tournament, TournamentConfig } from "@/lib/types";

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
  const templateExt = templateFile.name.split(".").pop() || "jpg";
  const dataExt = dataFile.name.split(".").pop() || "xlsx";

  const [templateLocation, dataLocation] = await Promise.all([
    saveUploadedFile(Buffer.from(await templateFile.arrayBuffer()), id, `template.${templateExt}`),
    saveUploadedFile(Buffer.from(await dataFile.arrayBuffer()), id, `data.${dataExt}`),
  ]);

  const config: TournamentConfig = JSON.parse(configJson);

  const tournament: Tournament = {
    id,
    name,
    eventDate: eventDate || new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    status: "draft",
    templatePath: templateLocation,
    dataPath: dataLocation,
    config,
    certificates: [],
  };

  await saveTournament(tournament);
  return NextResponse.json(tournament, { status: 201 });
}
