import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

const mocks = vi.hoisted(() => ({
  mockResolve4: vi.fn(),
  mockResolve6: vi.fn(),
  mockIsIPv4: vi.fn(),
  mockIsIPv6: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock("node:dns", () => ({
  default: {
    resolve4: (...args: unknown[]) => mocks.mockResolve4(...args),
    resolve6: (...args: unknown[]) => mocks.mockResolve6(...args),
  },
}));

vi.mock("node:net", () => ({
  default: {
    isIPv4: (...args: unknown[]) => mocks.mockIsIPv4(...args),
    isIPv6: (...args: unknown[]) => mocks.mockIsIPv6(...args),
  },
}));

vi.mock("node:http", () => ({
  default: { request: mocks.mockRequest },
}));

vi.mock("node:https", () => ({
  default: { request: mocks.mockRequest },
}));

import { ssrfFetch, isPrivateIP, SsrfError } from "../index";

function setupHttpMock(statusCode: number, headers: Record<string, string> = {}) {
  mocks.mockRequest.mockImplementation(
    (_opts: unknown, cb: unknown) => {
      if (typeof cb === "function") {
        const fakeResponse = { statusCode, headers, resume: vi.fn() };
        const fakeReq = {
          on: vi.fn(),
          end: vi.fn(() => { cb(fakeResponse); }),
          destroy: vi.fn(),
        };
        return fakeReq;
      }
      const fakeReq = {
        on: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      };
      return fakeReq;
    },
  );
}

function setupRedirectThen(
  redirectCode: number,
  location: string,
  finalCode: number,
) {
  let call = 0;
  mocks.mockRequest.mockImplementation(
    (_opts: unknown, cb: unknown) => {
      if (typeof cb !== "function") {
        return { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };
      }
      call++;
      const code = call === 1 ? redirectCode : finalCode;
      const hdrs = call === 1 ? { location } : {};
      const fakeResponse = { statusCode: code, headers: hdrs, resume: vi.fn() };
      const fakeReq = {
        on: vi.fn(),
        end: vi.fn(() => { cb(fakeResponse); }),
        destroy: vi.fn(),
      };
      return fakeReq;
    },
  );
}

function setupRedirectMockSequence(
  responses: Array<{ statusCode: number; headers: Record<string, string> }>,
) {
  let call = 0;
  mocks.mockRequest.mockImplementation(
    (_opts: unknown, cb: unknown) => {
      if (typeof cb !== "function") {
        return { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };
      }
      const resp = responses[call] || responses[responses.length - 1];
      call++;
      const fakeResponse = { statusCode: resp.statusCode, headers: resp.headers, resume: vi.fn() };
      const fakeReq = {
        on: vi.fn(),
        end: vi.fn(() => { cb(fakeResponse); }),
        destroy: vi.fn(),
      };
      return fakeReq;
    },
  );
}

type CapturedLookupFn = (
  hostname: string,
  options: { family?: number; all?: boolean },
  callback: (
    err: unknown,
    address?: string | Array<{ address: string; family: number }>,
    family?: number,
  ) => void,
) => void;

type CapturedRequestOpts = {
  hostname?: string;
  port?: number;
  path?: string;
  method?: string;
  rejectUnauthorized?: unknown;
  lookup?: CapturedLookupFn;
};

function setupCapturingHttp(
  responses: Array<{ statusCode: number; headers: Record<string, string> }> = [
    { statusCode: 200, headers: {} },
  ],
): CapturedRequestOpts[] {
  const captured: CapturedRequestOpts[] = [];
  mocks.mockRequest.mockImplementation(
    (opts: unknown, cb: unknown) => {
      captured.push(
        (opts ?? {}) as CapturedRequestOpts,
      );
      if (typeof cb !== "function") {
        return { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };
      }
      const resp =
        responses[captured.length - 1] || responses[responses.length - 1];
      const fakeResponse = { statusCode: resp.statusCode, headers: resp.headers, resume: vi.fn() };
      const fakeReq = {
        on: vi.fn(),
        end: vi.fn(() => { cb(fakeResponse); }),
        destroy: vi.fn(),
      };
      return fakeReq;
    },
  );
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockIsIPv4.mockImplementation((ip: string) => /^\d+\.\d+\.\d+\.\d+$/.test(ip));
  mocks.mockIsIPv6.mockImplementation((ip: string) => ip.includes(":"));
  mocks.mockResolve4.mockImplementation(
    (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
      cb(new Error("ENOTFOUND"));
    },
  );
  mocks.mockResolve6.mockImplementation(
    (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
      cb(new Error("ENOTFOUND"));
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isPrivateIP", () => {
  describe("IPv4 private/reserved", () => {
    it("rejects 0.0.0.0/8", () => {
      expect(isPrivateIP("0.0.0.0")).toBe(true);
      expect(isPrivateIP("0.255.255.255")).toBe(true);
    });

    it("rejects 10.0.0.0/8", () => {
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("10.255.255.255")).toBe(true);
    });

    it("rejects 127.0.0.0/8", () => {
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("127.255.255.255")).toBe(true);
    });

    it("rejects 169.254.0.0/16", () => {
      expect(isPrivateIP("169.254.0.1")).toBe(true);
      expect(isPrivateIP("169.254.255.255")).toBe(true);
    });

    it("rejects 172.16.0.0/12", () => {
      expect(isPrivateIP("172.16.0.1")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
    });

    it("allows 172.15.0.1", () => {
      expect(isPrivateIP("172.15.0.1")).toBe(false);
    });

    it("allows 172.32.0.1", () => {
      expect(isPrivateIP("172.32.0.1")).toBe(false);
    });

    it("rejects 192.168.0.0/16", () => {
      expect(isPrivateIP("192.168.0.1")).toBe(true);
      expect(isPrivateIP("192.168.255.255")).toBe(true);
    });
  });

  describe("IPv4 public", () => {
    it("accepts 8.8.8.8", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
    });

    it("accepts 1.1.1.1", () => {
      expect(isPrivateIP("1.1.1.1")).toBe(false);
    });
  });

  describe("IPv6", () => {
    it("rejects ::1", () => {
      expect(isPrivateIP("::1")).toBe(true);
    });

    it("rejects ::", () => {
      expect(isPrivateIP("::")).toBe(true);
    });

    it("rejects fc00::1", () => {
      expect(isPrivateIP("fc00::1")).toBe(true);
    });

    it("rejects fd00::1", () => {
      expect(isPrivateIP("fd00::1")).toBe(true);
    });

    it("rejects fe80::1", () => {
      expect(isPrivateIP("fe80::1")).toBe(true);
    });

    it("accepts 2606:4700::1", () => {
      expect(isPrivateIP("2606:4700::1")).toBe(false);
    });

    it("accepts 2001:db8::1", () => {
      expect(isPrivateIP("2001:db8::1")).toBe(false);
    });
  });

  describe("unknown format", () => {
    it("treats non-IP as private", () => {
      expect(isPrivateIP("not-an-ip")).toBe(true);
    });
  });
});

describe("ssrfFetch", () => {
  describe("scheme validation", () => {
    it("rejects ftp://", async () => {
      await expect(ssrfFetch("ftp://example.com")).rejects.toThrow(SsrfError);
    });

    it("rejects file://", async () => {
      await expect(ssrfFetch("file:///etc/passwd")).rejects.toThrow(SsrfError);
    });

    it("rejects data:", async () => {
      await expect(ssrfFetch("data:text/html,hi")).rejects.toThrow(SsrfError);
    });

    it("rejects javascript:", async () => {
      await expect(ssrfFetch("javascript:alert(1)")).rejects.toThrow(SsrfError);
    });

    it("rejects invalid URL", async () => {
      await expect(ssrfFetch("not-a-url")).rejects.toThrow(SsrfError);
    });

    it("accepts http://", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(200);
      const result = await ssrfFetch("http://example.com");
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it("accepts https://", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(200);
      const result = await ssrfFetch("https://example.com");
      expect(result.ok).toBe(true);
    });
  });

  describe("IP blocking via DNS", () => {
    it("blocks 127.0.0.1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["127.0.0.1"]),
      );
      await expect(ssrfFetch("http://internal.test")).rejects.toThrow(SsrfError);
    });

    it("blocks 10.0.0.1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["10.0.0.1"]),
      );
      await expect(ssrfFetch("http://internal.test")).rejects.toThrow(SsrfError);
    });

    it("blocks 172.16.0.1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["172.16.0.1"]),
      );
      await expect(ssrfFetch("http://internal.test")).rejects.toThrow(SsrfError);
    });

    it("blocks 192.168.1.1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["192.168.1.1"]),
      );
      await expect(ssrfFetch("http://internal.test")).rejects.toThrow(SsrfError);
    });

    it("blocks 169.254.169.254 (cloud metadata)", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["169.254.169.254"]),
      );
      await expect(ssrfFetch("http://metadata.test")).rejects.toThrow(SsrfError);
    });

    it("blocks 0.0.0.1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["0.0.0.1"]),
      );
      await expect(ssrfFetch("http://zero.test")).rejects.toThrow(SsrfError);
    });

    it("blocks IPv6 ::1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null) => void) => cb(new Error("ENOTFOUND")),
      );
      mocks.mockResolve6.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["::1"]),
      );
      await expect(ssrfFetch("http://ipv6.test")).rejects.toThrow(SsrfError);
    });

    it("blocks IPv6 fc00::1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null) => void) => cb(new Error("ENOTFOUND")),
      );
      mocks.mockResolve6.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["fc00::1"]),
      );
      await expect(ssrfFetch("http://ipv6.test")).rejects.toThrow(SsrfError);
    });

    it("blocks IPv6 fe80::1", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null) => void) => cb(new Error("ENOTFOUND")),
      );
      mocks.mockResolve6.mockImplementation(
        (_h: string, cb: (err: Error | null, addrs?: string[]) => void) => cb(null, ["fe80::1"]),
      );
      await expect(ssrfFetch("http://ipv6.test")).rejects.toThrow(SsrfError);
    });

    it("allows public IP 8.8.8.8", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(200);
      const result = await ssrfFetch("http://example.com");
      expect(result.ok).toBe(true);
    });

    it("allows public IP 1.1.1.1", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["1.1.1.1"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(200);
      const result = await ssrfFetch("http://example.com");
      expect(result.ok).toBe(true);
    });

    it("fails on DNS resolution error", async () => {
      mocks.mockResolve4.mockImplementation(
        (_h: string, cb: (err: Error | null) => void) => cb(new Error("ENOTFOUND")),
      );
      mocks.mockResolve6.mockImplementation(
        (_h: string, cb: (err: Error | null) => void) => cb(new Error("ENOTFOUND")),
      );
      await expect(ssrfFetch("http://nonexistent.invalid")).rejects.toThrow(SsrfError);
    });
  });

  describe("redirect handling", () => {
    it("follows safe redirect", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "a.com") cb(null, ["8.8.8.8"]);
          else if (h === "b.com") cb(null, ["1.1.1.1"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupRedirectThen(302, "http://b.com/final", 200);
      const result = await ssrfFetch("http://a.com");
      expect(result.ok).toBe(true);
    });

    it("blocks redirect to private IP", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "a.com") cb(null, ["8.8.8.8"]);
          else if (h === "internal.test") cb(null, ["10.0.0.1"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupRedirectThen(302, "http://internal.test/secret", 200);
      await expect(ssrfFetch("http://a.com")).rejects.toThrow(SsrfError);
    });

    it("blocks redirect to ftp:// scheme", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "a.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupRedirectThen(302, "ftp://files.test/payload", 200);
      await expect(ssrfFetch("http://a.com")).rejects.toThrow(SsrfError);
    });

    it("rejects too many redirects", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "a.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupRedirectMockSequence(
        Array.from({ length: 10 }, (_, i) => ({
          statusCode: 302,
          headers: { location: `http://a.com/r${i + 1}` },
        })),
      );
      await expect(ssrfFetch("http://a.com")).rejects.toThrow(SsrfError);
    });

    it("blocks redirect to private IP after safe initial resolve", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "a.com") cb(null, ["8.8.8.8"]);
          else if (h === "evil.com") cb(null, ["127.0.0.1"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupRedirectThen(301, "http://evil.com/admin", 200);
      await expect(ssrfFetch("http://a.com")).rejects.toThrow(SsrfError);
    });
  });

  describe("response", () => {
    it("returns ok for 200", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(200);
      const result = await ssrfFetch("http://example.com");
      expect(result).toMatchObject({ ok: true, status: 200 });
    });

    it("returns not ok for 404", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(404);
      const result = await ssrfFetch("http://example.com");
      expect(result).toMatchObject({ ok: false, status: 404 });
    });

    it("returns not ok for 500", async () => {
      mocks.mockResolve4.mockImplementation(
        (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          if (h === "example.com") cb(null, ["8.8.8.8"]);
          else cb(new Error("ENOTFOUND"));
        },
      );
      setupHttpMock(500);
      const result = await ssrfFetch("http://example.com");
      expect(result).toMatchObject({ ok: false, status: 500 });
    });
  });
});

describe("ssrfFetch DNS-rebinding pinning", () => {
  it("connects through the validated IP via a pinned lookup callback", async () => {
    mocks.mockResolve4.mockImplementation(
      (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
        if (h === "example.com") cb(null, ["93.184.216.34"]);
        else cb(new Error("ENOTFOUND"));
      },
    );
    const captured = setupCapturingHttp();

    const result = await ssrfFetch("http://example.com");
    expect(result.ok).toBe(true);

    expect(captured).toHaveLength(1);
    const opts = captured[0];
    expect(opts.hostname).toBe("example.com");
    expect(typeof opts.lookup).toBe("function");

    const one: { err?: unknown; address?: string; family?: number } = {};
    opts.lookup!("example.com", { family: 0, all: false }, (err, address, family) => {
      one.err = err;
      one.address = typeof address === "string" ? address : undefined;
      one.family = family;
    });
    expect(one.err).toBeNull();
    expect(one.address).toBe("93.184.216.34");
    expect(one.family).toBe(4);

    const all: { err?: unknown; addresses?: Array<{ address: string; family: number }> } = {};
    opts.lookup!("example.com", { family: 0, all: true }, (err, address) => {
      all.err = err;
      if (Array.isArray(address)) {
        all.addresses = address as Array<{ address: string; family: number }>;
      }
    });
    expect(all.err).toBeNull();
    expect(all.addresses).toContainEqual({ address: "93.184.216.34", family: 4 });
  });

  it("does not perform a second DNS resolution for the connection", async () => {
    mocks.mockResolve4.mockImplementation(
      (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
        if (h === "example.com") cb(null, ["93.184.216.34"]);
        else cb(new Error("ENOTFOUND"));
      },
    );
    const captured = setupCapturingHttp();

    const result = await ssrfFetch("http://example.com");
    expect(result.ok).toBe(true);

    const opts = captured[0];
    expect(typeof opts.lookup).toBe("function");
    opts.lookup!("example.com", { family: 0, all: false }, () => {});

    expect(mocks.mockResolve4).toHaveBeenCalledTimes(1);
    expect(mocks.mockResolve6).toHaveBeenCalledTimes(1);
  });

  it("preserves the original hostname for HTTPS while pinning the socket address", async () => {
    mocks.mockResolve4.mockImplementation(
      (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
        if (h === "example.com") cb(null, ["93.184.216.34"]);
        else cb(new Error("ENOTFOUND"));
      },
    );
    const captured = setupCapturingHttp();

    const result = await ssrfFetch("https://example.com");
    expect(result.ok).toBe(true);

    const opts = captured[0];
    expect(opts.hostname).toBe("example.com");
    expect(opts.port).toBe(443);
    expect(opts.rejectUnauthorized).not.toBe(false);

    const one: { err?: unknown; address?: string; family?: number } = {};
    opts.lookup!("example.com", { family: 0, all: false }, (err, address, family) => {
      one.err = err;
      one.address = typeof address === "string" ? address : undefined;
      one.family = family;
    });
    expect(one.err).toBeNull();
    expect(one.address).toBe("93.184.216.34");
    expect(one.family).toBe(4);
  });

  it("follows a redirect with an explicit port without failing on the port", async () => {
    mocks.mockResolve4.mockImplementation(
      (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
        if (h === "a.com") cb(null, ["8.8.8.8"]);
        else if (h === "example.com") cb(null, ["93.184.216.34"]);
        else cb(new Error("ENOTFOUND"));
      },
    );
    const captured = setupCapturingHttp([
      { statusCode: 302, headers: { location: "https://example.com:8443/final" } },
      { statusCode: 200, headers: {} },
    ]);

    const result = await ssrfFetch("http://a.com");
    expect(result.ok).toBe(true);

    expect(captured).toHaveLength(2);
    expect(captured[0].hostname).toBe("a.com");
    expect(captured[1].hostname).toBe("example.com");
    expect(captured[1].port).toBe("8443");

    const one: { err?: unknown; address?: string; family?: number } = {};
    captured[1].lookup!("example.com", { family: 0, all: false }, (err, address, family) => {
      one.err = err;
      one.address = typeof address === "string" ? address : undefined;
      one.family = family;
    });
    expect(one.err).toBeNull();
    expect(one.address).toBe("93.184.216.34");
    expect(one.family).toBe(4);
  });

  it("pins each redirect hop to its own validated address set", async () => {
    mocks.mockResolve4.mockImplementation(
      (h: string, cb: (err: Error | null, addrs?: string[]) => void) => {
        if (h === "a.com") cb(null, ["8.8.8.8"]);
        else if (h === "b.com") cb(null, ["1.1.1.1"]);
        else cb(new Error("ENOTFOUND"));
      },
    );
    const captured = setupCapturingHttp([
      { statusCode: 301, headers: { location: "http://b.com/final" } },
      { statusCode: 200, headers: {} },
    ]);

    const result = await ssrfFetch("http://a.com");
    expect(result.ok).toBe(true);

    expect(captured).toHaveLength(2);
    expect(captured[0].hostname).toBe("a.com");
    expect(captured[1].hostname).toBe("b.com");
    expect(captured[0].lookup).not.toBe(captured[1].lookup);

    const first: { address?: string; family?: number } = {};
    captured[0].lookup!("a.com", { family: 0, all: false }, (_err, address, family) => {
      first.address = typeof address === "string" ? address : undefined;
      first.family = family;
    });
    expect(first.address).toBe("8.8.8.8");
    expect(first.family).toBe(4);

    const second: { address?: string; family?: number } = {};
    captured[1].lookup!("b.com", { family: 0, all: false }, (_err, address, family) => {
      second.address = typeof address === "string" ? address : undefined;
      second.family = family;
    });
    expect(second.address).toBe("1.1.1.1");
    expect(second.family).toBe(4);
  });
});
