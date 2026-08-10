import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  properties: {
    textColor: { type: "string", description: "Hex color that matches the certificate's design for filled-in text, e.g. #8B1E1E" },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "What this blank is for, e.g. 'Recipient Name'" },
          columnIndex: { type: "integer", description: "0-based index of the matching spreadsheet column" },
          centerX: { type: "integer", description: "X pixel coordinate of the blank's horizontal center" },
          topY: { type: "integer", description: "Y pixel coordinate of the top of the text baseline area" },
          maxWidth: { type: "integer", description: "Maximum text width in pixels that fits the blank" },
          fontSize: { type: "integer", description: "Recommended font size in px matching surrounding text" },
          format: { type: "string", enum: ["text", "number", "ordinal"] },
        },
        required: ["label", "columnIndex", "centerX", "topY", "maxWidth", "fontSize", "format"],
        additionalProperties: false,
      },
    },
  },
  required: ["textColor", "fields"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to your environment variables to enable auto-detection." },
      { status: 500 }
    );
  }

  const { imageBase64, mediaType, columns, width, height } = await request.json();
  if (!imageBase64 || !columns?.length) {
    return NextResponse.json({ error: "Missing template image or column headers" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 },
            },
            {
              type: "text",
              text: `This is a certificate template image, ${width}x${height} pixels. Identify every blank space (underlines, empty gaps after labels like "awarded to", "Name:", "Rank:", "Points:", etc.) where recipient-specific text must be filled in.

The participant spreadsheet has these columns (0-based index: header):
${(columns as string[]).map((c, i) => `${i}: ${c}`).join("\n")}

For each blank, match it to the most appropriate spreadsheet column and give precise pixel coordinates (centerX = horizontal center of the blank, topY = top of where the text should be drawn, maxWidth = width available). Choose fontSize to match nearby printed text. Use format "ordinal" for rank/place fields (renders 1st, 2nd...), "number" for numeric scores, "text" otherwise. Only include blanks that have a matching column. Pick textColor to complement the certificate design.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Detection was declined. Please configure fields manually." }, { status: 500 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No detection result returned" }, { status: 500 });
    }

    const result = JSON.parse(textBlock.text);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Auto-detection failed: ${msg}` }, { status: 500 });
  }
}
