/**
 * Resume object-storage abstraction (Batch 89).
 *
 * Thin, lazy wrapper over S3-compatible object storage (Amazon S3 or
 * Cloudflare R2). Holds no credentials in logs, never logs object bodies,
 * filenames, or storage keys, and maps SDK failures to neutral internal error
 * codes. The bucket is assumed private and no public/signed URL is ever
 * generated here.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export type ResumeStorageConfig = {
  endpoint: string | null;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

/** Internal (non-PII) error codes for resume storage failures. */
export type ResumeStorageErrorCode =
  | "RESUME_STORAGE_NOT_CONFIGURED"
  | "RESUME_STORAGE_UNAVAILABLE"
  | "RESUME_STORAGE_UPLOAD_FAILED"
  | "RESUME_STORAGE_FETCH_FAILED"
  | "RESUME_STORAGE_DELETE_FAILED";

export class ResumeStorageError extends Error {
  readonly code: ResumeStorageErrorCode;
  constructor(code: ResumeStorageErrorCode) {
    super("Resume storage operation failed");
    this.name = "ResumeStorageError";
    this.code = code;
  }
}

/**
 * Reads the required storage configuration from the environment. Returns null
 * when any required variable is missing so callers can fail neutrally.
 * Credential values are never logged.
 */
export function getResumeStorageConfig(): ResumeStorageConfig | null {
  const bucket = process.env.RESUME_STORAGE_BUCKET?.trim();
  const accessKeyId = process.env.RESUME_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.RESUME_STORAGE_SECRET_ACCESS_KEY?.trim();
  const region = process.env.RESUME_STORAGE_REGION?.trim() || "auto";

  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  const forcePathStyle = process.env.RESUME_STORAGE_FORCE_PATH_STYLE === "true";

  return {
    endpoint: process.env.RESUME_STORAGE_ENDPOINT?.trim() || null,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
  };
}

export function isResumeStorageConfigured(): boolean {
  return getResumeStorageConfig() !== null;
}

let cachedClient: S3Client | null = null;

/**
 * Returns a lazily-created, process-cached S3Client. Construction happens only
 * on first use, so missing environment configuration never breaks the build or
 * unrelated requests.
 */
export function createResumeStorageClient(): S3Client {
  if (cachedClient) return cachedClient;

  const config = getResumeStorageConfig();
  if (!config) {
    throw new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED");
  }

  cachedClient = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
  });

  return cachedClient;
}

function requireBucket(): {
  client: S3Client;
  bucket: string;
} {
  const config = getResumeStorageConfig();
  if (!config) {
    throw new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED");
  }
  return { client: createResumeStorageClient(), bucket: config.bucket };
}

/**
 * Uploads an object. `contentLength` is derived from the byte length so the
 * provider cannot be tricked by a mismatched header.
 */
export async function putResumeObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const { client, bucket } = requireBucket();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
      }),
    );
  } catch (err) {
    if (err instanceof ResumeStorageError) throw err;
    throw new ResumeStorageError("RESUME_STORAGE_UPLOAD_FAILED");
  }
}

export type ResumeObject = {
  body: NodeJS.ReadableStream;
  contentType: string | undefined;
  contentLength: number | undefined;
};

/**
 * Fetches an object by key. Returns null when the object does not exist.
 * The provider body is streamed back for proxy download.
 */
export async function getResumeObject(
  key: string,
): Promise<ResumeObject | null> {
  const { client, bucket } = requireBucket();
  try {
    const output = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = output.Body;
    if (!body) return null;
    return {
      body: body as unknown as NodeJS.ReadableStream,
      contentType: output.ContentType,
      contentLength: output.ContentLength,
    };
  } catch (err) {
    if (err instanceof ResumeStorageError) throw err;
    if (isNoSuchKey(err)) return null;
    throw new ResumeStorageError("RESUME_STORAGE_FETCH_FAILED");
  }
}

export async function deleteResumeObject(key: string): Promise<void> {
  const { client, bucket } = requireBucket();
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  } catch (err) {
    if (err instanceof ResumeStorageError) throw err;
    throw new ResumeStorageError("RESUME_STORAGE_DELETE_FAILED");
  }
}

function isNoSuchKey(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "NoSuchKey" || name === "NotFound";
}
