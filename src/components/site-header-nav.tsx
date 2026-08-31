"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";
const idle = "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100";
const active = "font-medium text-blue-600 dark:text-blue-400";

export function HeaderNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`text-sm ${focus} ${isActive ? active : idle}`}
    >
      {children}
    </Link>
  );
}

export function HeaderNavItems({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`text-sm ${focus} ${isActive ? active : idle}`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}
