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
  { href: "/notifications", label: "Notifications" },
  { href: "/organization/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/organization") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OrganizationNav({
  unreadNotificationCount = 0,
}: {
  unreadNotificationCount?: number;
}) {
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
            const isNotifications = link.href === "/notifications";
            const showBadge = isNotifications && unreadNotificationCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${focusRing} ${
                  active
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                {link.label}
                {showBadge && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
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
