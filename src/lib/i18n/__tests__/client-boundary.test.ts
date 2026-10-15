import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");

const I18N_BARREL_RE = /from\s+["']@\/lib\/i18n["']/;
const NEXT_HEADERS_RE = /["']next\/headers["']/;

const SKIP_DIRS = new Set(["__tests__", "db", "messages"]);

function collectOffenders(dir: string): string[] {
  const offenders: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      offenders.push(...collectOffenders(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      const source = readFileSync(full, "utf8");
      if (source.includes('"use client"') && I18N_BARREL_RE.test(source)) {
        offenders.push(full);
      }
    }
  }
  return offenders;
}

describe("client/server module boundary", () => {
  it("no client component imports the i18n barrel (which re-exports server.ts)", () => {
    expect(collectOffenders(SRC_ROOT)).toEqual([]);
  });

  it("language-switcher imports only client-safe i18n modules", () => {
    const source = readFileSync(
      join(SRC_ROOT, "components", "language-switcher.tsx"),
      "utf8",
    );
    expect(source).toContain('"use client"');

    const i18nImports = [
      ...source.matchAll(/import\s+[^"']+\s+from\s+["'](@\/lib\/i18n[^"']*)["']/g),
    ].map((match) => match[1]);

    expect(i18nImports).toEqual(
      expect.arrayContaining([
        "@/lib/i18n/client",
        "@/lib/i18n/locale",
        "@/lib/i18n/routing",
      ]),
    );
    expect(i18nImports).not.toContain("@/lib/i18n");
    expect(i18nImports).not.toContain("@/lib/i18n/server");
  });

  it("client-safe i18n modules never import next/headers", () => {
    const clientSafeModules = [
      join(SRC_ROOT, "lib", "i18n", "client.tsx"),
      join(SRC_ROOT, "lib", "i18n", "locale.ts"),
      join(SRC_ROOT, "lib", "i18n", "routing.ts"),
      join(SRC_ROOT, "lib", "i18n", "dictionary.ts"),
      join(SRC_ROOT, "lib", "i18n", "format.ts"),
    ];
    for (const file of clientSafeModules) {
      const source = readFileSync(file, "utf8");
      expect(NEXT_HEADERS_RE.test(source), `${file} must not import next/headers`).toBe(
        false,
      );
    }
  });
});