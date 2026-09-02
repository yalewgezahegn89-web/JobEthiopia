"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/brand-mark";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const links = [
  { href: "/organization", label: "Dashboard" },
  { href: "/organization/jobs", label: "Jobs" },
  { href: "/organization/applications", label: "Applications" },
  { href: "/organization/team", label: "Team" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/organization") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OrganizationNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Employer workspace"
      className="border-b border-border bg-surface shadow-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-4 px-4 py-3">
        <Link
          href="/organization"
          className={`flex shrink-0 items-center gap-2 rounded-lg text-sm font-bold text-foreground hover:text-primary ${focusRing}`}
          aria-label="Employer dashboard home"
        >
          <BrandMark size={26} />
          <span className="hidden sm:inline">JobEthiopia</span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto">
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

        <form action="/logout" method="POST" className="shrink-0">
          <button
            type="submit"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-foreground ${focusRing}`}
          >
            Logout
          </button>
        </form>
      </div>
    </nav>
  );
}
