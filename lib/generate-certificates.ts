import sharp from "sharp";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import type { TournamentConfig, FieldConfig } from "./types";

// Approximate bold sans-serif character widths relative to font-size.
// Good enough for auto-shrink; avoids needing a native font engine.
const AVG_CHAR_RATIO = 0.58;

function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AVG_CHAR_RATIO;
}

function fitFontSize(text: string, maxWidth: number, fontSize: number, minSize = 14): number {
  while (fontSize > minSize && estimateWidth(text, fontSize) > maxWidth) {
    fontSize -= 1;
  }
  return fontSize;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatValue(raw: unknown, fmt: FieldConfig["format"]): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (fmt === "ordinal") return ordinal(Number(raw));
  if (fmt === "number") {
    const f = parseFloat(String(raw));
    return isNaN(f) ? String(raw) : f === Math.floor(f) ? String(Math.floor(f)) : String(f);
  }
  return String(raw).trim();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function buildSvgOverlay(
  width: number,
  height: number,
  fields: FieldConfig[],
  values: Record<string, string>,
  textColor: string
): Buffer {
  const { r, g, b } = hexToRgb(textColor);
  const fill = `rgb(${r},${g},${b})`;

  const texts = fields.map((f) => {
    const text = values[f.id] ?? "";
    const fs = fitFontSize(text, f.maxWidth, f.fontSize);
    // SVG text-anchor="middle" handles horizontal centering; y is top + ascender
    const ascender = fs * 0.8;
    const y = f.topY + ascender;
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<text x="${f.centerX}" y="${y}" text-anchor="middle" font-family="DejaVu Sans,Arial,Helvetica,sans-serif" font-weight="bold" font-size="${fs}" fill="${fill}">${escaped}</text>`;
  });

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts.join("")}</svg>`;
  return Buffer.from(svg);
}

function loadRows(xlsxBuffer: Buffer, headerRowIndex: number): Record<number, unknown>[] {
  const wb = XLSX.read(xlsxBuffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
  const dataRows = all.slice(headerRowIndex + 1);

  // Keep only rows where the first column of config is numeric-ish
  return dataRows
    .filter((row) => {
      const first = (row as unknown[])[0];
      return first !== null && first !== undefined && first !== "" && !isNaN(Number(first));
    })
    .map((row) => {
      const obj: Record<number, unknown> = {};
      (row as unknown[]).forEach((cell, i) => { obj[i] = cell; });
      return obj;
    });
}

export interface GeneratedCertificate {
  rowIndex: number;
  name: string;
  buffer: Buffer;
  filename: string;
}

export async function generateCertificates(
  templateBuffer: Buffer,
  xlsxBuffer: Buffer,
  config: TournamentConfig,
  options: { previewOnly?: boolean } = {}
): Promise<GeneratedCertificate[]> {
  const meta = await sharp(templateBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  let rows = loadRows(xlsxBuffer, config.headerRowIndex);

  if (options.previewOnly) {
    // Pick the row with the longest name field
    const nameField = config.fields.find((f) => f.format === "text") ?? config.fields[0];
    let maxLen = -1, maxIdx = 0;
    rows.forEach((row, i) => {
      const len = String(row[nameField.columnIndex] ?? "").length;
      if (len > maxLen) { maxLen = len; maxIdx = i; }
    });
    rows = [rows[maxIdx]];
  }

  const results: GeneratedCertificate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const values: Record<string, string> = {};
    let recipientName = "";

    for (const field of config.fields) {
      const text = formatValue(row[field.columnIndex], field.format);
      values[field.id] = text;
      if (field.format === "text" && !recipientName) recipientName = text;
    }

    const svgOverlay = buildSvgOverlay(width, height, config.fields, values, config.textColor);
    const outputBuffer = await sharp(templateBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const safeName = recipientName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    const filename = `${String(i + 1).padStart(4, "0")}_${safeName}.png`;

    results.push({ rowIndex: i, name: recipientName, buffer: outputBuffer, filename });
  }

  return results;
}

// For local dev: write to a temp dir and return file paths
export async function generateCertificatesToDir(
  templateBuffer: Buffer,
  xlsxBuffer: Buffer,
  config: TournamentConfig,
  outputDir: string,
  options: { previewOnly?: boolean } = {}
): Promise<{ rowIndex: number; name: string; file: string }[]> {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const certs = await generateCertificates(templateBuffer, xlsxBuffer, config, options);
  return Promise.all(
    certs.map(async (c) => {
      const filePath = path.join(outputDir, c.filename);
      fs.writeFileSync(filePath, c.buffer);
      return { rowIndex: c.rowIndex, name: c.name, file: c.filename };
    })
  );
}
