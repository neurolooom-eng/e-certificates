import { google } from "googleapis";
import { Readable } from "stream";

function getAuth() {
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

export async function createFolder(name: string, parentId?: string) {
  const drive = google.drive({ version: "v3", auth: getAuth() });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id, webViewLink",
  });
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });
  return { id: res.data.id!, link: res.data.webViewLink! };
}

export async function uploadFileBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string
) {
  const drive = google.drive({ version: "v3", auth: getAuth() });
  const stream = Readable.from(buffer);
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: "id, webViewLink",
  });
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });
  return { id: res.data.id!, link: res.data.webViewLink! };
}
