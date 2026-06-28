import { NextResponse } from "next/server";
import { getTournament, saveTournament, readUploadedFile } from "@/lib/storage";
import { generateCertificates } from "@/lib/generate-certificates";
import { createFolder, uploadFileBuffer } from "@/lib/google-drive";
import type { Certificate } from "@/lib/types";

// Vercel Pro: allow up to 5 minutes for large batches
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  tournament.status = "generating";
  await saveTournament(tournament);

  try {
    const [templateBuffer, xlsxBuffer] = await Promise.all([
      readUploadedFile(tournament.templatePath),
      readUploadedFile(tournament.dataPath),
    ]);

    const generated = await generateCertificates(templateBuffer, xlsxBuffer, tournament.config);

    const folder = await createFolder(`${tournament.name} – Certificates`);
    tournament.driveFolderId = folder.id;
    tournament.driveFolderLink = folder.link;

    const certificates: Certificate[] = [];
    for (const cert of generated) {
      const { id: fileId, link } = await uploadFileBuffer(cert.buffer, cert.filename, "image/png", folder.id);
      certificates.push({
        rowIndex: cert.rowIndex,
        recipientName: cert.name,
        driveFileId: fileId,
        driveLink: link,
        generatedAt: new Date().toISOString(),
      });
    }

    tournament.certificates = certificates;
    tournament.status = "ready";
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
