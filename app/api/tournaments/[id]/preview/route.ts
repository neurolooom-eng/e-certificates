import { NextResponse } from "next/server";
import { getTournament, saveTournament, readUploadedFile } from "@/lib/storage";
import { generateCertificates } from "@/lib/generate-certificates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const [templateBuffer, xlsxBuffer] = await Promise.all([
      readUploadedFile(tournament.templatePath),
      readUploadedFile(tournament.dataPath),
    ]);

    const [preview] = await generateCertificates(templateBuffer, xlsxBuffer, tournament.config, {
      previewOnly: true,
    });

    if (!preview) return NextResponse.json({ error: "No data rows found" }, { status: 400 });

    // Mark as previewed so the Generate button becomes available
    if (tournament.status === "draft") {
      tournament.status = "previewed";
      await saveTournament(tournament);
    }

    return new Response(new Uint8Array(preview.buffer), {
      headers: {
        "Content-Type": "image/png",
        "X-Recipient-Name": encodeURIComponent(preview.name),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
