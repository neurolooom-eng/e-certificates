import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readTournaments, saveTournament, saveUploadedFile } from "@/lib/storage";
import type { Tournament, TournamentConfig, TournamentCategory } from "@/lib/types";

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
  const configJson = formData.get("config") as string;

  if (!name || !templateFile || !configJson) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = uuidv4();
  const eventType = (formData.get("eventType") as string) || undefined;
  const config: TournamentConfig = JSON.parse(configJson);
  const templateBuffer = Buffer.from(await templateFile.arrayBuffer());

  let templatePath: string;
  if (IS_VERCEL) {
    templatePath = `base64:${templateBuffer.toString("base64")}`;
  } else {
    templatePath = await saveUploadedFile(templateBuffer, id, `template.${templateFile.name.split(".").pop() || "jpg"}`);
  }

  // Support multiple categories OR single data file (backwards compat)
  const categoriesJson = formData.get("categories") as string | null;
  let categories: TournamentCategory[] | undefined;
  let dataPath = "";

  if (categoriesJson) {
    const categoryMeta: { name: string; age?: string; gender?: string; rounds?: string }[] =
      JSON.parse(categoriesJson);
    categories = [];
    for (let i = 0; i < categoryMeta.length; i++) {
      const file = formData.get(`categoryData_${i}`) as File | null;
      if (!file) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      let path: string;
      if (IS_VERCEL) {
        path = `base64:${buf.toString("base64")}`;
      } else {
        path = await saveUploadedFile(buf, id, `category_${i}_${file.name}`);
      }
      categories.push({
        name: categoryMeta[i].name,
        dataPath: path,
        age: categoryMeta[i].age || undefined,
        gender: categoryMeta[i].gender || undefined,
        rounds: categoryMeta[i].rounds || undefined,
      });
    }
    if (categories.length === 0) {
      return NextResponse.json({ error: "At least one category with a data file is required." }, { status: 400 });
    }
  } else {
    // Single-file mode (backwards compat)
    const dataFile = formData.get("data") as File | null;
    if (!dataFile) {
      return NextResponse.json({ error: "Missing participant list." }, { status: 400 });
    }
    const dataBuffer = Buffer.from(await dataFile.arrayBuffer());
    if (IS_VERCEL) {
      dataPath = `base64:${dataBuffer.toString("base64")}`;
    } else {
      dataPath = await saveUploadedFile(dataBuffer, id, `data.${dataFile.name.split(".").pop() || "xlsx"}`);
    }
  }

  const tournament: Tournament = {
    id,
    name,
    eventDate: eventDate || new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    status: "draft",
    eventType: eventType as Tournament["eventType"],
    templatePath,
    dataPath,
    categories,
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
