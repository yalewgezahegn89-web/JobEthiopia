"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/brand-mark";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const links = [
  { href: "/admin", label: "Admin Home" },
  { href: "/admin/jobs", label: "Job Moderation" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/employer-requests", label: "Employer Requests" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/taxonomy", label: "Taxonomy" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/operations", label: "Operations" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin workspace"
      className="border-b border-border bg-surface shadow-sm"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            aria-label="Admin home"
            className={`flex shrink-0 items-center gap-2 rounded-lg text-sm font-bold text-foreground hover:text-primary ${focusRing}`}
          >
            <BrandMark size={26} />
            <span className="hidden sm:inline">JobEthiopia</span>
          </Link>

          <form action="/logout" method="POST" className="shrink-0">
            <button
              type="submit"
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-foreground ${focusRing}`}
            >
              Logout
            </button>
          </form>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${focusRing} ${
                  active
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
