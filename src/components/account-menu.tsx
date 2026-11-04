"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

type LinkItem = { href: string; label: string };

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function AccountMenu({
  userName,
  links,
}: {
  userName: string;
  links: LinkItem[];
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors duration-150 hover:bg-surface-raised ${focusRing}`}
      >
        <span>{t.nav.account}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <nav
        id={menuId}
        aria-label={t.nav.accountNavLabel}
        hidden={!open}
        className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
      >
        <div className="border-b border-border-subtle px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
            {t.nav.account}
          </p>
          {userName ? (
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {userName}
            </p>
          ) : null}
        </div>

        <ul className="max-h-[70vh] overflow-y-auto py-2">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2 text-sm transition-colors duration-150 ${focusRing} ${
                    isActive
                      ? "bg-primary-light font-medium text-primary"
                      : "text-muted hover:bg-surface-raised hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <form action="/logout" method="POST" className="border-t border-border-subtle p-2">
          <button
            type="submit"
            className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive-light ${focusRing}`}
          >
            {t.nav.logOut}
          </button>
        </form>
      </nav>
    </div>
  );
}
