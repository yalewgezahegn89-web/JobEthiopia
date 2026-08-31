import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { HeaderNavLink, HeaderNavItems } from "@/components/site-header-nav";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/organizations", label: "Organizations" },
  { href: "/categories", label: "Categories" },
  { href: "/professions", label: "Professions" },
  { href: "/locations", label: "Locations" },
  { href: "/careers", label: "Careers" },
];

const candidateLinks = [
  { href: "/applications", label: "My Applications" },
  { href: "/saved-jobs", label: "Saved Jobs" },
  { href: "/profile", label: "Profile" },
];

const employerLinks = [
  { href: "/organization", label: "Organization" },
  { href: "/organization/jobs", label: "Jobs" },
  { href: "/organization/applications", label: "Applications" },
  { href: "/organization/team", label: "Team" },
];

export default async function SiteHeader() {
  const user = await getCurrentUser();

  let roleLinks: { href: string; label: string }[] = [];

  if (user) {
    if (isStaffRole(user.role)) {
      roleLinks = [{ href: "/admin", label: "Admin" }];
    } else if (user.role === "ORGANIZATION_ADMIN") {
      roleLinks = employerLinks;
    } else if (user.role === "CANDIDATE") {
      roleLinks = candidateLinks;
    }
  }

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-gray-100"
        >
          JobEthiopia
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <nav aria-label="Sections">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {publicLinks.map((link) => (
                <li key={link.href}>
                  <HeaderNavLink href={link.href}>{link.label}</HeaderNavLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Account">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {user ? (
                <>
                  <HeaderNavItems links={roleLinks} />
                  <li>
                    <form action="/logout" method="POST">
                      <button
                        type="submit"
                        className="text-sm font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                      >
                        Logout
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/employer/register"
                      className="text-sm font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    >
                      For Employers
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className="text-sm font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    >
                      Sign up
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="text-sm font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    >
                      Login
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
