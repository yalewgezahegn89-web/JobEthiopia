import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/careers", label: "Careers" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-gray-900 hover:text-gray-600 dark:text-gray-50 dark:hover:text-gray-300"
        >
          JobEthiopia
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}