import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { readTournaments, saveTournament, getUploadsDir } from "@/lib/storage";
import type { Tournament, TournamentConfig } from "@/lib/types";

export async function GET() {
  const tournaments = readTournaments();
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
  const uploadsDir = getUploadsDir(id);

  const templateExt = templateFile.name.split(".").pop() || "jpg";
  const templatePath = path.join(uploadsDir, `template.${templateExt}`);
  fs.writeFileSync(templatePath, Buffer.from(await templateFile.arrayBuffer()));

  const dataExt = dataFile.name.split(".").pop() || "xlsx";
  const dataPath = path.join(uploadsDir, `data.${dataExt}`);
  fs.writeFileSync(dataPath, Buffer.from(await dataFile.arrayBuffer()));

  const config: TournamentConfig = JSON.parse(configJson);

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

  saveTournament(tournament);
  return NextResponse.json(tournament, { status: 201 });
}
