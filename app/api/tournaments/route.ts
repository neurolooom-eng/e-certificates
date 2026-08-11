import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { visibleTo, isAdmin } from "@/lib/access";
import { isMember, getAcademy } from "@/lib/academies";
import { v4 as uuidv4 } from "uuid";
import { readTournaments, saveTournament, saveSourceFile } from "@/lib/storage";
import type { Tournament, TournamentConfig, TournamentCategory } from "@/lib/types";

export const maxDuration = 60;

const IS_VERCEL = !!process.env.VERCEL;

export async function GET() {
  const session = await getServerSession(authOptions);
  const tournaments = await readTournaments();
  return NextResponse.json(await visibleTo(tournaments, session));
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

  const session = await getServerSession(authOptions);
  const id = uuidv4();
  const eventType = (formData.get("eventType") as string) || undefined;

  // Stamp the academy, but only one the creator actually belongs to —
  // otherwise a member could file a tournament under someone else's banner.
  const academyId = (formData.get("academyId") as string) || "";
  let academy = null;
  if (academyId) {
    const userId = session?.user?.id;
    const allowed = isAdmin(session) || (!!userId && (await isMember(userId, academyId)));
    if (!allowed) {
      return NextResponse.json({ error: "You are not a member of that academy." }, { status: 403 });
    }
    academy = await getAcademy(academyId);
    if (!academy) {
      return NextResponse.json({ error: "That academy no longer exists." }, { status: 400 });
    }
  }
  const config: TournamentConfig = JSON.parse(configJson);
  const templateBuffer = Buffer.from(await templateFile.arrayBuffer());

  const templateExt = templateFile.name.split(".").pop() || "jpg";
  const templatePath = await saveSourceFile(
    templateBuffer,
    id,
    `template.${templateExt}`,
    templateFile.type || "image/jpeg"
  );

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
      const path = await saveSourceFile(
        buf,
        id,
        `category_${i}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
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
    dataPath = await saveSourceFile(
      dataBuffer,
      id,
      "data.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  const tournament: Tournament = {
    id,
    name,
    eventDate: eventDate || new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    status: "draft",
    eventType: eventType as Tournament["eventType"],
    ownerId: session?.user?.id,
    ownerName: session?.user?.name ?? undefined,
    academyId: academy?.id,
    academyName: academy?.name,
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
