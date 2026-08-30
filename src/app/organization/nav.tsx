"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OrganizationNav() {
  const pathname = usePathname();

  const links = [
    { href: "/organization", label: "Dashboard" },
    { href: "/organization/jobs", label: "Jobs" },
    { href: "/organization/applications", label: "Applications" },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link
          href="/jobs"
          className="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          JobEthiopia
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm ${
              pathname === link.href
                ? "font-medium text-blue-600 dark:text-blue-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
