import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readTournaments, saveTournament, saveUploadedFile } from "@/lib/storage";
import { getRootFolder, createFolder, uploadFileBuffer, getFileDownloadUrl } from "@/lib/google-drive";
import type { Tournament, TournamentConfig } from "@/lib/types";

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
    // Store uploads in Google Drive — survives across serverless invocations
    const rootId = await getRootFolder();
    const uploadFolder = await createFolder(`${name} – Uploads`, rootId);
    const [tmpl, data] = await Promise.all([
      uploadFileBuffer(templateBuffer, `template.${templateExt}`, templateFile.type || "image/jpeg", uploadFolder.id, false),
      uploadFileBuffer(dataBuffer, `data.${dataExt}`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uploadFolder.id, false),
    ]);
    templatePath = await getFileDownloadUrl(tmpl.id);
    dataPath = await getFileDownloadUrl(data.id);
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

  await saveTournament(tournament);
  return NextResponse.json(tournament, { status: 201 });
}
