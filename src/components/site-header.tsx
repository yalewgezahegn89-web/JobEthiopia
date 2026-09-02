import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { HeaderNavLink, HeaderNavItems } from "@/components/site-header-nav";
import { BrandMark } from "@/components/ui/brand-mark";
import { MobileHeader } from "@/components/mobile-header";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/organizations", label: "Organizations" },
  { href: "/careers", label: "Careers" },
];

const secondaryLinks = [
  { href: "/categories", label: "Categories" },
  { href: "/professions", label: "Professions" },
  { href: "/locations", label: "Locations" },
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

const anonymousLinks = [
  { href: "/employer/register", label: "For Employers" },
  { href: "/register", label: "Sign up" },
  { href: "/login", label: "Login" },
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

  const userInfo = user ? { name: user.name ?? "", role: user.role } : null;

  return (
    <>
      <header className="border-b border-border-subtle bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 py-3">
            <BrandMark size={28} />
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              JobEthiopia
            </Link>
          </div>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <HeaderNavLink href={link.href}>{link.label}</HeaderNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Browse" className="hidden xl:block">
            <ul className="flex items-center">
              {secondaryLinks.map((link) => (
                <li key={link.href}>
                  <HeaderNavLink href={link.href}>{link.label}</HeaderNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden lg:block">
            <nav aria-label="Account">
              <ul className="flex items-center gap-x-2">
                {user ? (
                  <>
                    <HeaderNavItems links={roleLinks} />
                    <li>
                      <form action="/logout" method="POST">
                        <button
                          type="submit"
                          className="text-sm font-medium text-muted hover:text-destructive transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                        className="text-sm font-medium text-muted hover:text-foreground transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        For Employers
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/login"
                        className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised hover:border-border shadow-sm hover:shadow-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Login
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/register"
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover shadow-sm hover:shadow-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Sign up
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>

          <div className="lg:hidden">
            <MobileHeader
              userInfo={userInfo}
              roleLinks={roleLinks}
              primaryLinks={[...primaryLinks, ...secondaryLinks]}
              anonymousLinks={anonymousLinks}
            />
          </div>
        </div>
      </header>
    </>
  );
}
