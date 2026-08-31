import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = s3Mocks.send;
  }
  class PutObjectCommand {
    constructor(public input: unknown) {}
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  class DeleteObjectCommand {
    constructor(public input: unknown) {}
  }
  return {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
  };
});

import {
  getResumeStorageConfig,
  isResumeStorageConfigured,
  putResumeObject,
  getResumeObject,
  deleteResumeObject,
  ResumeStorageError,
} from "../storage";

const ENV_KEYS = [
  "RESUME_STORAGE_ENDPOINT",
  "RESUME_STORAGE_REGION",
  "RESUME_STORAGE_BUCKET",
  "RESUME_STORAGE_ACCESS_KEY_ID",
  "RESUME_STORAGE_SECRET_ACCESS_KEY",
  "RESUME_STORAGE_FORCE_PATH_STYLE",
];

function setConfigEnv() {
  process.env.RESUME_STORAGE_ENDPOINT = "https://s3.example.com";
  process.env.RESUME_STORAGE_REGION = "auto";
  process.env.RESUME_STORAGE_BUCKET = "my-bucket";
  process.env.RESUME_STORAGE_ACCESS_KEY_ID = "ak";
  process.env.RESUME_STORAGE_SECRET_ACCESS_KEY = "sk";
  delete process.env.RESUME_STORAGE_FORCE_PATH_STYLE;
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  s3Mocks.send.mockReset();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("resume storage config", () => {
  it("is unconfigured when required variables are missing", () => {
    expect(isResumeStorageConfigured()).toBe(false);
    expect(getResumeStorageConfig()).toBeNull();
  });

  it("parses configured variables with defaults", () => {
    setConfigEnv();
    const config = getResumeStorageConfig();
    expect(config).not.toBeNull();
    expect(config!.bucket).toBe("my-bucket");
    expect(config!.region).toBe("auto");
    expect(config!.endpoint).toBe("https://s3.example.com");
    expect(config!.forcePathStyle).toBe(false);
  });

  it("honors force-path-style opt-in", () => {
    setConfigEnv();
    process.env.RESUME_STORAGE_FORCE_PATH_STYLE = "true";
    expect(getResumeStorageConfig()!.forcePathStyle).toBe(true);
  });
});

describe("resume storage errors when unconfigured", () => {
  it("throws RESUME_STORAGE_NOT_CONFIGURED for operations", async () => {
    await expect(
      putResumeObject("resumes/k.pdf", new Uint8Array([1]), "application/pdf"),
    ).rejects.toThrowError(new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED"));
    await expect(getResumeObject("resumes/k.pdf")).rejects.toThrowError(
      new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED"),
    );
    await expect(deleteResumeObject("resumes/k.pdf")).rejects.toThrowError(
      new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED"),
    );
  });
});

describe("resume storage operations (configured)", () => {
  beforeEach(() => {
    setConfigEnv();
  });

  it("uploads an object with bucket, key, and content length", async () => {
    s3Mocks.send.mockResolvedValue({});
    const body = new Uint8Array([37, 80, 68, 70, 45]);
    await putResumeObject("resumes/k.pdf", body, "application/pdf");
    expect(s3Mocks.send).toHaveBeenCalledTimes(1);
    const command = s3Mocks.send.mock.calls[0][0] as { input: unknown };
    const input = command.input as {
      Bucket: string;
      Key: string;
      Body: Uint8Array;
      ContentLength: number;
    };
    expect(input.Bucket).toBe("my-bucket");
    expect(input.Key).toBe("resumes/k.pdf");
    expect(input.Body.byteLength).toBe(5);
    expect(input.ContentLength).toBe(5);
  });

  it("maps provider upload failures to RESUME_STORAGE_UPLOAD_FAILED", async () => {
    s3Mocks.send.mockRejectedValue(new Error("network"));
    await expect(
      putResumeObject("resumes/k.pdf", new Uint8Array([1]), "application/pdf"),
    ).rejects.toThrowError(new ResumeStorageError("RESUME_STORAGE_UPLOAD_FAILED"));
  });

  it("returns null for a missing object (NoSuchKey)", async () => {
    s3Mocks.send.mockRejectedValue(Object.assign(new Error("missing"), { name: "NoSuchKey" }));
    await expect(getResumeObject("resumes/k.pdf")).resolves.toBeNull();
  });

  it("returns the body, content type, and length for an existing object", async () => {
    const readable = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("PDF"));
        c.close();
      },
    });
    s3Mocks.send.mockResolvedValue({
      Body: readable,
      ContentType: "application/pdf",
      ContentLength: 3,
    });
    const result = await getResumeObject("resumes/k.pdf");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("application/pdf");
    expect(result!.contentLength).toBe(3);
  });

  it("maps provider fetch failures to RESUME_STORAGE_FETCH_FAILED for non-missing errors", async () => {
    s3Mocks.send.mockRejectedValue(new Error("boom"));
    await expect(getResumeObject("resumes/k.pdf")).rejects.toThrowError(
      new ResumeStorageError("RESUME_STORAGE_FETCH_FAILED"),
    );
  });

  it("maps provider delete failures to RESUME_STORAGE_DELETE_FAILED", async () => {
    s3Mocks.send.mockRejectedValue(new Error("boom"));
    await expect(deleteResumeObject("resumes/k.pdf")).rejects.toThrowError(
      new ResumeStorageError("RESUME_STORAGE_DELETE_FAILED"),
    );
  });
});
