/**
 * Cloudflare R2 object storage (S3-compatible).
 *
 * Chosen over Vercel Blob because the free tier is 10 GB with no egress
 * charges — a single 650-certificate tournament is roughly 130 MB, which
 * exhausts smaller allowances quickly.
 *
 * Configure with:
 *   R2_ACCOUNT_ID         Cloudflare account id
 *   R2_ACCESS_KEY_ID      R2 API token access key
 *   R2_SECRET_ACCESS_KEY  R2 API token secret
 *   R2_BUCKET             bucket name
 *   R2_PUBLIC_BASE_URL    optional: public bucket / custom domain base URL
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const bucket = () => process.env.R2_BUCKET!;

/**
 * Reference stored for an object. When a public base URL is configured the
 * object is served straight from R2; otherwise it is served through the app,
 * so certificate links work either way.
 */
export function r2Href(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return `/api/file?k=${encodeURIComponent(key)}`;
}

/** Turn a stored reference back into the object key. */
export function keyFromHref(href: string): string | null {
  if (!href) return null;
  if (href.startsWith("/api/file?k=")) {
    return decodeURIComponent(href.slice("/api/file?k=".length));
  }
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base && href.startsWith(base)) {
    return decodeURIComponent(href.slice(base.length + 1));
  }
  return null;
}

export async function r2Put(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Metadata is re-read immediately after writing (status, progress)
      CacheControl: key.endsWith(".json") ? "no-store" : "public, max-age=31536000, immutable",
    })
  );
  return r2Href(key);
}

export async function r2GetBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  } catch {
    return null;
  }
}

export async function r2GetStream(
  key: string
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string | null } | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!res.Body) return null;
    return {
      stream: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      contentType: res.ContentType ?? null,
    };
  } catch {
    return null;
  }
}

export async function r2List(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token })
    );
    for (const item of res.Contents ?? []) if (item.Key) keys.push(item.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function r2DeletePrefix(prefix: string): Promise<number> {
  const keys = await r2List(prefix);
  // DeleteObjects takes at most 1000 keys per call
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
  }
  return keys.length;
}
