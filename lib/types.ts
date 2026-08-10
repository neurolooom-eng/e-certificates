export interface FieldConfig {
  id: string;
  label: string;
  columnIndex: number;
  centerX: number;
  topY: number;
  maxWidth: number;
  fontSize: number;
  format: "text" | "number" | "ordinal";
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
