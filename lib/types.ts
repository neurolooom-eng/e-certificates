export interface FieldConfig {
  id: string;
  label: string;
  columnIndex: number;
  centerX: number;
  topY: number;
  maxWidth: number;
  fontSize: number;
  /**
   * "tick" draws a checkmark instead of text. It is drawn only when the value
   * in `columnIndex` matches `matchValue` (case-insensitive). Leave matchValue
   * empty to always draw the tick.
   */
  format: "text" | "number" | "ordinal" | "tick";
  matchValue?: string;
  /** Box height in px — used by the visual designer and to centre ticks. */
  boxHeight?: number;
  /**
   * Where the value comes from. "column" reads the participant's row;
   * "meta" reads tournament/category metadata parsed from the sheet header
   * (or overridden by the organiser) — the same for every row in a category.
   */
  source?: "column" | "meta";
  /** Which metadata value to use when source is "meta". */
  metaKey?: "category" | "age" | "gender" | "rounds" | "title";
  /** Literal text placed before/after the value, e.g. "Rounds: " or " Rounds". */
  prefix?: string;
  suffix?: string;
  /**
   * Cleanup for name columns. Results exports write names as "Surname, First"
   * and often leave a trailing comma when there is no first name.
   *  - "trim" (default for text): drop leading/trailing commas
   *  - "swap": "Ayaan, Yukash" → "Yukash Ayaan"
   *  - "none": leave the cell exactly as-is
   */
  nameCleanup?: "none" | "trim" | "swap";
}

export interface TournamentConfig {
  headerRowIndex: number;
  textColor: string;
  fields: FieldConfig[];
}

export type TournamentStatus = "draft" | "previewed" | "generating" | "ready" | "error";

export interface GenerationProgress {
  current: number;
  total: number;
}

export interface TournamentCategory {
  name: string;
  dataPath: string;
  /** Organiser overrides — blank means "use what was parsed from the sheet". */
  age?: string;
  gender?: string;
  rounds?: string;
}

export interface Certificate {
  rowIndex: number;
  recipientName: string;
  driveFileId: string;
  driveLink: string;
  generatedAt: string;
  category?: string;
}

export type EventType = "open" | "open_category" | "category";

export interface Tournament {
  eventType?: EventType;
  archived?: boolean;
  progress?: GenerationProgress;
  id: string;
  name: string;
  eventDate: string;
  createdAt: string;
  status: TournamentStatus;
  templatePath: string;
  dataPath: string;
  categories?: TournamentCategory[];
  config: TournamentConfig;
  certificates: Certificate[];
  driveFolderId?: string;
  driveFolderLink?: string;
  errorMessage?: string;
}
