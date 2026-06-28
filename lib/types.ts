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

export interface Certificate {
  rowIndex: number;
  recipientName: string;
  driveFileId: string;
  driveLink: string;
  generatedAt: string;
}

export type TournamentStatus = "draft" | "generating" | "ready" | "error";

export interface Tournament {
  id: string;
  name: string;
  eventDate: string;
  createdAt: string;
  status: TournamentStatus;
  templatePath: string;
  dataPath: string;
  config: TournamentConfig;
  certificates: Certificate[];
  driveFolderId?: string;
  driveFolderLink?: string;
  errorMessage?: string;
}
