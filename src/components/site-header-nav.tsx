"use client";

import { usePathname } from "next/navigation";
import { LocalizedLink } from "@/components/i18n/localized-link";
import { isActivePath } from "@/lib/i18n/routing";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const idle = "text-muted hover:text-foreground transition-colors duration-150";
const active = "font-medium text-primary";

export function HeaderNavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, href);

  return (
    <LocalizedLink
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`whitespace-nowrap px-2.5 py-2 rounded-lg text-sm ${focus} ${
        isActive ? active : idle
      } ${className}`}
    >
      {children}
    </LocalizedLink>
  );
}

export function HeaderNavItems({
  links,
  className = "",
}: {
  links: { href: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const isActive = isActivePath(pathname, link.href);
        return (
          <li key={link.href}>
            <LocalizedLink
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap px-2.5 py-2 rounded-lg text-sm ${focus} ${
                isActive ? active : idle
              } ${className}`}
            >
              {link.label}
            </LocalizedLink>
          </li>
        );
      })}
    </>
  );
}
