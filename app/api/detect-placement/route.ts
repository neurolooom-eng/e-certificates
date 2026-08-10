import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

const SCHEMA = {
  type: "object",
  properties: {
    textColor: {
      type: "string",
      description: "Hex color for filled-in text that matches the certificate's design, e.g. #8B1E1E",
    },
    notes: {
      type: "string",
      description: "One sentence on what was found, and anything the organiser should check.",
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "What this blank is for, e.g. 'Recipient Name' or 'Tick — Under 8'" },
          source: {
            type: "string",
            enum: ["column", "meta"],
            description: "'column' reads the participant's spreadsheet row; 'meta' reads category metadata that is the same for every row in a category.",
          },
          columnIndex: {
            type: "integer",
            description: "0-based spreadsheet column index when source is 'column'. Use -1 when source is 'meta'.",
          },
          metaKey: {
            type: "string",
            enum: ["category", "age", "gender", "rounds", "title", "none"],
            description: "Which metadata value to use when source is 'meta'. Use 'none' when source is 'column'.",
          },
          format: {
            type: "string",
            enum: ["text", "number", "ordinal", "tick"],
            description: "'ordinal' renders 1st/2nd/3rd. 'tick' draws a checkmark instead of text.",
          },
          matchValue: {
            type: "string",
            description: "For 'tick' fields only: draw the tick when the source value equals this, e.g. '8' or 'Boys'. Empty string for non-tick fields.",
          },
          prefix: { type: "string", description: "Literal text before the value, usually empty." },
          suffix: { type: "string", description: "Literal text after the value, usually empty." },
          centerX: { type: "integer", description: "X pixel coordinate of the blank's horizontal center" },
          topY: { type: "integer", description: "Y pixel coordinate of the top of the text area" },
          maxWidth: { type: "integer", description: "Width in pixels available for the text" },
          boxHeight: { type: "integer", description: "Height in pixels of the blank / tick box" },
          fontSize: { type: "integer", description: "Font size in px matching nearby printed text (tick size for tick fields)" },
        },
        required: [
          "label", "source", "columnIndex", "metaKey", "format", "matchValue",
          "prefix", "suffix", "centerX", "topY", "maxWidth", "boxHeight", "fontSize",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["textColor", "notes", "fields"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to your environment variables to enable auto-detection." },
      { status: 500 }
    );
  }

  const { imageBase64, mediaType, columns, samples, meta, width, height } = await request.json();
  if (!imageBase64 || !columns?.length) {
    return NextResponse.json({ error: "Missing template image or column headers" }, { status: 400 });
  }

  const client = new Anthropic();

  // Show each column with a real value so matching is grounded in the data,
  // not just the header text.
  const columnList = (columns as string[])
    .map((c, i) => {
      const sample = samples?.[i];
      return `${i}: "${c}"${sample ? `  (e.g. ${sample})` : "  (empty)"}`;
    })
    .join("\n");

  const metaList = meta
    ? [
        meta.category ? `category = "${meta.category}"` : null,
        meta.age ? `age = "${meta.age}"` : null,
        meta.gender ? `gender = "${meta.gender}"` : null,
        meta.rounds ? `rounds = "${meta.rounds}"` : null,
      ].filter(Boolean).join(", ")
    : "";

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
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
              text: `You are configuring an automated certificate generator. This certificate template is ${width}x${height} pixels. Read the whole certificate and find every place that must be filled in per recipient, then map each one to the data below.

## The participant spreadsheet
Each column is listed as "index: header (example value)":
${columnList}
${metaList ? `\n## Category metadata (parsed from the sheet's header text, same for every row in this category)\n${metaList}` : ""}

## What to find

There are three kinds of fill-ins. Look for all three:

1. **Blanks fed by the spreadsheet** — dotted lines, underlines, or gaps after phrases like "presented to", "of", "scored ___ points", "placed ___". Set source="column" and pick the columnIndex whose example value actually fits that sentence. Use format "ordinal" for rank/place (renders 1st, 2nd), "number" for scores and points, "text" for names and clubs.

2. **Blanks fed by category metadata** — a gap that takes the same value for everyone in a category rather than a per-person value. The clearest case is a rounds blank ("scored ___ points in ___ rounds"): the round count is the same for the whole category, so use source="meta" with metaKey="rounds", NOT a spreadsheet column. Same for a blank naming the category or age group.

3. **Printed options that must be ticked** — a certificate often prints every option and expects one to be marked, e.g. "in the under 8 / 11 / 14 / 17 - Boys / Girls Category". Create one field with format="tick" for EACH printed option. Put its box tightly over that option's text (centerX/topY/maxWidth/boxHeight covering just that number or word). Set source="meta", metaKey="age" for age numbers, metaKey="gender" for Boys/Girls, and matchValue to exactly the option as it must match ("8", "11", "14", "17", "Boys", "Girls"). A separate field per option — never one field for the whole list.

## Coordinates

centerX is the horizontal center of the space to fill, topY is the top of where the text sits, maxWidth is how much width is available before running into other printed text, boxHeight is the line height. For a blank on a ruled line, the text sits just above the line — topY should place it there, not on top of the line. Choose fontSize to match the printed text next to it.

Do not invent fields for printed text that never changes (titles, signature names, organiser names, dates already printed). Only include a source="column" field when a column genuinely fits — if a blank has no matching column and no matching metadata, leave it out and say so in notes.

Set textColor to a color that suits the certificate's palette for handwritten-style entries.`,
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

    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Auto-detection failed: ${msg}` }, { status: 500 });
  }
}
