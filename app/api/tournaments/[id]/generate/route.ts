import { NextResponse } from "next/server";
import { getTournament, saveTournament, readUploadedFile } from "@/lib/storage";
import { generateCertificates } from "@/lib/generate-certificates";
import { createFolder, uploadFileBuffer, getRootFolder } from "@/lib/google-drive";
import type { Certificate } from "@/lib/types";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  tournament.status = "generating";
  tournament.progress = { current: 0, total: 0 };
  await saveTournament(tournament);

  try {
    const [templateBuffer, xlsxBuffer] = await Promise.all([
      readUploadedFile(tournament.templatePath),
      readUploadedFile(tournament.dataPath),
    ]);

    // Render all certificates in memory first
    const generated = await generateCertificates(templateBuffer, xlsxBuffer, tournament.config);

    // Update total count so the UI can show X / N
    tournament.progress = { current: 0, total: generated.length };
    await saveTournament(tournament);

    const rootId = await getRootFolder();
    const folder = await createFolder(`${tournament.name} – Certificates`, rootId);
    tournament.driveFolderId = folder.id;
    tournament.driveFolderLink = folder.link;

    const certificates: Certificate[] = [];
    for (let i = 0; i < generated.length; i++) {
      const cert = generated[i];
      const { id: fileId, link } = await uploadFileBuffer(
        cert.buffer,
        cert.filename,
        "image/png",
        folder.id
      );
      certificates.push({
        rowIndex: cert.rowIndex,
        recipientName: cert.name,
        driveFileId: fileId,
        driveLink: link,
        generatedAt: new Date().toISOString(),
      });

      // Save progress after each upload so the UI can poll it
      tournament.certificates = certificates;
      tournament.progress = { current: i + 1, total: generated.length };
      await saveTournament(tournament);
    }

    tournament.status = "ready";
    tournament.progress = { current: generated.length, total: generated.length };
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
