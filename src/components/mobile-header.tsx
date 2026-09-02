"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type LinkItem = { href: string; label: string };

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const itemIdle =
  "block px-4 py-3 text-base rounded-lg text-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-150";
const itemActive =
  "block px-4 py-3 text-base rounded-lg font-medium text-primary bg-primary-light";

export function MobileHeader({
  userInfo,
  roleLinks,
  primaryLinks,
  anonymousLinks,
}: {
  userInfo: { name: string; role: string } | null;
  roleLinks: LinkItem[];
  primaryLinks: LinkItem[];
  anonymousLinks: LinkItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className={`inline-flex items-center justify-center rounded-lg p-2 text-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-150 ${focusRing}`}
      >
        {isOpen ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden" data-testid="mobile-menu-panel">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute top-0 right-0 flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-4">
              <span className="text-base font-bold text-foreground">Menu</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className={`rounded-lg p-2 text-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-150 ${focusRing}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="p-4">
              <ul className="space-y-1">
                {primaryLinks.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={close}
                        aria-current={isActive ? "page" : undefined}
                        className={`${focusRing} ${
                          isActive ? itemActive : itemIdle
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-border-subtle p-4">
              <p className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-subtle">
                Account
              </p>
              {userInfo ? (
                <ul className="mt-1 space-y-1">
                  {roleLinks.map((link) => {
                    const isActive =
                      pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={close}
                          aria-current={isActive ? "page" : undefined}
                          className={`${focusRing} ${
                            isActive ? itemActive : itemIdle
                          }`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                  <li className="pt-2">
                    <form action="/logout" method="POST">
                      <button
                        type="submit"
                        className={`w-full rounded-lg px-4 py-3 text-left text-base font-medium text-destructive hover:bg-destructive-light transition-colors duration-150 ${focusRing}`}
                      >
                        Logout
                      </button>
                    </form>
                  </li>
                </ul>
              ) : (
                <ul className="mt-1 space-y-1">
                  {anonymousLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={close}
                        className={`${focusRing} ${itemIdle}`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}