"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const isActive =
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`px-3 py-2 rounded-lg text-sm ${focus} ${
        isActive ? active : idle
      } ${className}`}
    >
      {children}
    </Link>
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
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`px-3 py-2 rounded-lg text-sm ${focus} ${
                isActive ? active : idle
              } ${className}`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}
