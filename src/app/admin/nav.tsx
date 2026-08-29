import Link from "next/link";

/**
 * Minimal staff admin navigation (Batch 51).
 *
 * Rendered by the /admin/jobs pages so no Batch 50 file (layout/page) is
 * modified. Link targets are internal and constants.
 */
export default function AdminNav() {
  const links = [
    { href: "/admin", label: "Admin Home" },
    { href: "/admin/jobs", label: "Job Moderation" },
  ];

  return (
    <nav aria-label="Admin" className="border-b border-neutral-200">
      <ul className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-neutral-700 hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
