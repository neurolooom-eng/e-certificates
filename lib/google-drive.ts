import { google } from "googleapis";
import { Readable } from "stream";

function getDrive() {
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Root folder: must be a Google Drive folder owned by a real user
 * and shared (Editor) with the service account.
 * Set GOOGLE_DRIVE_FOLDER_ID in your environment variables.
 */
export function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error(
    "GOOGLE_DRIVE_FOLDER_ID is not set. Create a folder in Google Drive, share it with the service account (Editor), and paste the folder ID as this env var."
  );
  return id;
}

// ── Folders ────────────────────────────────────────────────────────────────

export async function createFolder(name: string, parentId?: string) {
  const drive = getDrive();
  const parent = parentId ?? getRootFolderId();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    },
    fields: "id, webViewLink",
  });
  await makePublic(drive, res.data.id!);
  return { id: res.data.id!, link: res.data.webViewLink! };
}

// ── Files ──────────────────────────────────────────────────────────────────

export async function uploadFileBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
  makeFilePublic = true
) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });
  if (makeFilePublic) await makePublic(drive, res.data.id!);
  return { id: res.data.id!, link: res.data.webViewLink! };
}

async function makePublic(drive: ReturnType<typeof google.drive>, fileId: string) {
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
}

// ── Kept for backwards compat (generate route uses this) ──────────────────
export async function getRootFolder(): Promise<string> {
  return getRootFolderId();
}
