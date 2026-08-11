import { NextResponse } from "next/server";
import { getTournament, saveTournament, readUploadedFile, blobUploadBuffer } from "@/lib/storage";
import { canAccess } from "@/lib/access";
import { generateCertificates } from "@/lib/generate-certificates";
import type { Certificate } from "@/lib/types";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccess(tournament))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resuming keeps whatever was already uploaded; a fresh run starts empty.
  const resuming = tournament.status === "paused" || tournament.status === "stopped";
  // Blob URLs end with the object path, so an existing certificate tells us
  // that path is already uploaded.
  const alreadyDone = new Set(
    resuming ? tournament.certificates.map((c) => decodeURI(c.driveLink)) : []
  );
  if (!resuming) tournament.certificates = [];

  tournament.status = "generating";
  tournament.generationControl = "run";
  tournament.progress = { current: tournament.certificates.length, total: 0 };
  await saveTournament(tournament);

  try {
    const templateBuffer = await readUploadedFile(tournament.templatePath);

    // Build list of { categoryName, xlsxBuffer, overrides } to process
    const sources: {
      categoryName: string;
      xlsxBuffer: Buffer;
      overrides: { age?: string; gender?: string; rounds?: string };
    }[] = [];

    if (tournament.categories && tournament.categories.length > 0) {
      for (const cat of tournament.categories) {
        sources.push({
          categoryName: cat.name,
          xlsxBuffer: await readUploadedFile(cat.dataPath),
          overrides: { age: cat.age, gender: cat.gender, rounds: cat.rounds },
        });
      }
    } else {
      sources.push({
        categoryName: "",
        xlsxBuffer: await readUploadedFile(tournament.dataPath),
        overrides: {},
      });
    }

    // Count total certificates across all categories
    const allGenerated: Array<{ categoryName: string; cert: Awaited<ReturnType<typeof generateCertificates>>[number] }> = [];
    for (const { categoryName, xlsxBuffer, overrides } of sources) {
      const certs = await generateCertificates(templateBuffer, xlsxBuffer, tournament.config, {
        categoryName,
        metaOverrides: overrides,
      });
      for (const cert of certs) allGenerated.push({ categoryName, cert });
    }

    tournament.progress = { current: tournament.certificates.length, total: allGenerated.length };
    await saveTournament(tournament);

    const certificates: Certificate[] = [...tournament.certificates];

    for (let i = 0; i < allGenerated.length; i++) {
      const { categoryName, cert } = allGenerated[i];
      const prefix = categoryName ? `${categoryName}/` : "";
      const pathname = `tournaments/${id}/certs/${prefix}${cert.filename}`;

      // Check the control flag between certificates so pause/stop take effect
      // mid-run without killing the request from the outside.
      const control = (await getTournament(id))?.generationControl;
      if (control === "pause" || control === "stop") {
        tournament.certificates = certificates;
        tournament.status = control === "pause" ? "paused" : "stopped";
        tournament.generationControl = "run";
        tournament.progress = { current: certificates.length, total: allGenerated.length };
        await saveTournament(tournament);
        return NextResponse.json({
          status: tournament.status,
          count: certificates.length,
          total: allGenerated.length,
        });
      }

      // Skip anything a previous run already uploaded
      if ([...alreadyDone].some((link) => link.endsWith(pathname))) continue;

      const url = await blobUploadBuffer(cert.buffer, pathname, "image/png");
      certificates.push({
        rowIndex: cert.rowIndex,
        recipientName: cert.name,
        driveFileId: "",
        driveLink: url,
        category: categoryName || undefined,
        rank: cert.rank,
        generatedAt: new Date().toISOString(),
      });

      tournament.certificates = certificates;
      tournament.progress = { current: certificates.length, total: allGenerated.length };
      await saveTournament(tournament);
    }

    tournament.status = "ready";
    tournament.progress = { current: certificates.length, total: allGenerated.length };
    await saveTournament(tournament);

    return NextResponse.json({ status: "ready", count: certificates.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    tournament.status = "error";
    tournament.errorMessage = msg;
    await saveTournament(tournament);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
