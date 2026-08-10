/**
 * Extracts per-category metadata from the header rows of a results export.
 *
 * Chess-Results.com sheets carry the details we need as free text above the
 * table, e.g.:
 *
 *   3rd FIITJEE Tamilnadu State Level Children's Chess Tournament
 *   @ 9th August 2026 UNDER 8 BOYS ROUND 6 @ 3PM
 *   Final Ranking after 6 Rounds
 *
 * From that we pull the age group, the gender, and the number of rounds so
 * certificates can print them and tick the right boxes without the organiser
 * re-typing anything per category.
 */

export interface SheetMeta {
  /** Combined label, e.g. "Under 8 Boys" */
  category: string;
  /** Age group as a bare number string, e.g. "8" */
  age: string;
  /** "Boys" | "Girls" | "Open" | "" */
  gender: string;
  /** Number of rounds as a string, e.g. "6" */
  rounds: string;
  /** The longest header line — usually the full tournament title */
  title: string;
}

export const EMPTY_META: SheetMeta = { category: "", age: "", gender: "", rounds: "", title: "" };

/** Scan the free text above the results table. */
export function parseHeaderText(lines: string[]): SheetMeta {
  const text = lines.join("  ");

  // Rounds: "Final Ranking after 6 Rounds" wins over "ROUND 6" (the latter is
  // often the round being played, not the total).
  const roundsMatch =
    text.match(/after\s+(\d+)\s+round/i) ||
    text.match(/(\d+)\s*rounds?\b/i) ||
    text.match(/\bround\s*(\d+)/i);
  const rounds = roundsMatch ? roundsMatch[1] : "";

  // Age: "UNDER 8", "U-8", "U8"
  const ageMatch = text.match(/under\s*-?\s*(\d{1,2})\b/i) || text.match(/\bu\s*-?\s*(\d{1,2})\b/i);
  const age = ageMatch ? ageMatch[1] : "";

  // Gender
  const genderMatch = text.match(/\b(boys|girls|men|women|open|mixed)\b/i);
  let gender = "";
  if (genderMatch) {
    const g = genderMatch[1].toLowerCase();
    gender = g === "boys" || g === "men" ? "Boys"
      : g === "girls" || g === "women" ? "Girls"
      : "Open";
  }

  const category = [age ? `Under ${age}` : "", gender].filter(Boolean).join(" ");
  const title = lines.reduce((longest, l) => (l.length > longest.length ? l : longest), "");

  return { category, age, gender, rounds, title };
}

/**
 * Pull the header lines out of a parsed sheet (rows as arrays of cells) and
 * derive the metadata. `headerRowIndex` marks the table's column header, so
 * everything above it is free text.
 */
export function metaFromRows(rows: unknown[][], headerRowIndex: number): SheetMeta {
  const upto = Math.max(headerRowIndex, 6);
  const lines = rows
    .slice(0, upto)
    .map((r) => (Array.isArray(r) ? r.filter(Boolean).map(String).join(" ") : String(r ?? "")))
    .filter((l) => l.trim().length > 0);
  return parseHeaderText(lines);
}

/**
 * Find the row that holds the table's column headers.
 *
 * Results exports carry several lines of free text above the table, so the
 * header is rarely row 0. We look for the row that contains a recognisable
 * combination of column names.
 */
export function detectHeaderRow(rows: unknown[][]): number {
  const wanted = ["name", "rk", "sno", "pts", "fed", "rtg", "club"];
  let bestRow = 0;
  let bestScore = 0;

  rows.slice(0, 15).forEach((row, i) => {
    if (!Array.isArray(row)) return;
    const cells = row.map((c) => String(c ?? "").trim().toLowerCase().replace(/\.$/, ""));
    const score = wanted.filter((w) => cells.some((c) => c === w || c.startsWith(w))).length;
    if (score > bestScore) { bestScore = score; bestRow = i; }
  });

  // Need at least a couple of recognisable headers to trust the guess
  return bestScore >= 2 ? bestRow : 0;
}

/** A field the auto-mapper knows how to recognise from a column header. */
export interface MappedColumn {
  key: "name" | "club" | "points" | "rank";
  columnIndex: number;
}

/**
 * Match column headers to the fields a certificate usually needs, so the
 * organiser doesn't have to map them by hand.
 */
export function mapColumns(header: unknown[]): MappedColumn[] {
  const cells = header.map((c) => String(c ?? "").trim().toLowerCase().replace(/\.$/, ""));
  const find = (tests: ((c: string) => boolean)[]): number => {
    for (const test of tests) {
      const i = cells.findIndex(test);
      if (i >= 0) return i;
    }
    return -1;
  };

  const out: MappedColumn[] = [];
  const name = find([(c) => c === "name", (c) => c.includes("name")]);
  // "Club/City" — but never the FED (federation) column
  const club = find([
    (c) => c.includes("club") || c.includes("city"),
    (c) => c === "school" || c.includes("academy"),
  ]);
  const points = find([(c) => c === "pts" || c === "points", (c) => c.startsWith("pts")]);
  const rank = find([(c) => c === "rk" || c === "rank" || c === "pos", (c) => c.startsWith("rk")]);

  if (name >= 0) out.push({ key: "name", columnIndex: name });
  if (club >= 0) out.push({ key: "club", columnIndex: club });
  if (points >= 0) out.push({ key: "points", columnIndex: points });
  if (rank >= 0) out.push({ key: "rank", columnIndex: rank });
  return out;
}

/** Resolve a metadata key for a field, falling back to an empty string. */
export function metaValue(meta: SheetMeta | undefined, key: string | undefined): string {
  if (!meta || !key) return "";
  switch (key) {
    case "category": return meta.category;
    case "age": return meta.age;
    case "gender": return meta.gender;
    case "rounds": return meta.rounds;
    case "title": return meta.title;
    default: return "";
  }
}
