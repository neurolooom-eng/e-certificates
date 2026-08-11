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

/** Trim stray whitespace/newlines — pasted dashboard values often carry them. */
function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * The account id is a 32-character hex string, but the dashboard shows it
 * inside the S3 API endpoint, so that whole URL is an easy thing to paste by
 * mistake. Accept either and pull the id out.
 */
export function accountId(): string {
  const raw = env("R2_ACCOUNT_ID");
  const fromUrl = raw.match(/([0-9a-f]{32})\.r2\.cloudflarestorage\.com/i);
  if (fromUrl) return fromUrl[1];
  return raw.replace(/^https?:\/\//, "").split("/")[0].split(".")[0];
}

/** Public base URL, with the scheme added if it was left off. */
export function publicBaseUrl(): string {
  const raw = env("R2_PUBLIC_BASE_URL") || env("NEXT_PUBLIC_R2_PUBLIC_BASE_URL");
  if (!raw) return "";
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

export function isR2Configured(): boolean {
  return !!(
    accountId() &&
    env("R2_ACCESS_KEY_ID") &&
    env("R2_SECRET_ACCESS_KEY") &&
    env("R2_BUCKET")
  );
}

/** Why the configuration is unusable, or null when it looks sound. */
export function r2ConfigProblem(): string | null {
  const id = accountId();
  if (!id) return "R2_ACCOUNT_ID is empty.";
  if (!/^[0-9a-f]{32}$/i.test(id)) {
    return `R2_ACCOUNT_ID should be the 32-character account id (got ${id.length} characters). Copy the hex part of the S3 API URL, e.g. https://<this-part>.r2.cloudflarestorage.com/<bucket>.`;
  }
  if (!env("R2_ACCESS_KEY_ID")) return "R2_ACCESS_KEY_ID is empty.";
  if (!env("R2_SECRET_ACCESS_KEY")) return "R2_SECRET_ACCESS_KEY is empty.";
  if (!env("R2_BUCKET")) return "R2_BUCKET is empty.";
  if (env("R2_BUCKET").includes("/")) return "R2_BUCKET should be just the bucket name, not a URL.";
  return null;
}

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const problem = r2ConfigProblem();
  if (problem) throw new Error(problem);
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

const bucket = () => env("R2_BUCKET");

/**
 * Reference stored for an object. When a public base URL is configured the
 * object is served straight from R2; otherwise it is served through the app,
 * so certificate links work either way.
 */
export function r2Href(key: string): string {
  const base = publicBaseUrl();
  if (base) return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return `/api/file?k=${encodeURIComponent(key)}`;
}

/** Turn a stored reference back into the object key. */
export function keyFromHref(href: string): string | null {
  if (!href) return null;
  if (href.startsWith("/api/file?k=")) {
    return decodeURIComponent(href.slice("/api/file?k=".length));
  }
  const base = publicBaseUrl();
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
