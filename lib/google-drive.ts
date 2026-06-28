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

// ── Folders ────────────────────────────────────────────────────────────────

export async function createFolder(name: string, parentId?: string) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
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
    fields: "id, webViewLink, webContentLink",
  });
  if (makeFilePublic) await makePublic(drive, res.data.id!);
  return {
    id: res.data.id!,
    link: res.data.webViewLink!,
    downloadLink: res.data.webContentLink ?? undefined,
  };
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

async function makePublic(drive: ReturnType<typeof google.drive>, fileId: string) {
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
}

// ── Root app folder (created once, shared by all tournaments) ──────────────

let _rootFolderId: string | null = null;

export async function getRootFolder(): Promise<string> {
  if (_rootFolderId) return _rootFolderId;
  const drive = getDrive();
  // Look for existing folder
  const list = await drive.files.list({
    q: "name='E-Certificates App' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id)",
    spaces: "drive",
  });
  if (list.data.files?.length) {
    _rootFolderId = list.data.files[0].id!;
    return _rootFolderId;
  }
  const folder = await createFolder("E-Certificates App");
  _rootFolderId = folder.id;
  return _rootFolderId;
}
