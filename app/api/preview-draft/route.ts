import { NextResponse } from "next/server";
import { generateCertificates } from "@/lib/generate-certificates";
import type { TournamentConfig } from "@/lib/types";

export const maxDuration = 60;

/**
 * Render a single sample certificate from an uploaded template + data file,
 * without creating a tournament. Used by the create form so the organiser can
 * adjust field placement before committing.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const templateFile = formData.get("template") as File | null;
    const dataFile = formData.get("data") as File | null;
    const configJson = formData.get("config") as string | null;
    const categoryName = (formData.get("categoryName") as string) || undefined;
    const overridesJson = formData.get("metaOverrides") as string | null;

    if (!templateFile || !dataFile || !configJson) {
      return NextResponse.json(
        { error: "Upload the template and a participant list first." },
        { status: 400 }
      );
    }

    const config: TournamentConfig = JSON.parse(configJson);
    const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
    const xlsxBuffer = Buffer.from(await dataFile.arrayBuffer());

    const [preview] = await generateCertificates(templateBuffer, xlsxBuffer, config, {
      previewOnly: true,
      categoryName,
      metaOverrides: overridesJson ? JSON.parse(overridesJson) : undefined,
    });

    if (!preview) {
      return NextResponse.json(
        { error: "No data rows found — check the header row index." },
        { status: 400 }
      );
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
