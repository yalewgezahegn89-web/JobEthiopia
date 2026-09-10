import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { HeaderNavLink, HeaderNavItems } from "@/components/site-header-nav";
import { BrandMark } from "@/components/ui/brand-mark";
import { MobileHeader } from "@/components/mobile-header";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getI18n } from "@/lib/i18n/server";

export default async function SiteHeader() {
  const user = await getCurrentUser();
  const t = await getI18n();

  const primaryLinks = [
    { href: "/", label: t.nav.home },
    { href: "/jobs", label: t.nav.jobs },
    { href: "/organizations", label: t.nav.organizations },
    { href: "/careers", label: t.nav.careers },
  ];

  const secondaryLinks = [
    { href: "/categories", label: t.nav.categories },
    { href: "/professions", label: t.nav.professions },
    { href: "/locations", label: t.nav.locations },
  ];

const candidateLinks = [
    { href: "/applications", label: t.nav.myApplications },
    { href: "/saved-jobs", label: t.nav.savedJobs },
    { href: "/profile", label: t.nav.profile },
    { href: "/job-alerts", label: t.nav.jobAlerts },
  ];

  const employerLinks = [
    { href: "/organization", label: t.nav.organization },
    { href: "/organization/jobs", label: t.nav.jobs },
    { href: "/organization/applications", label: t.nav.applications },
    { href: "/organization/team", label: t.nav.team },
  ];

  const anonymousLinks = [
    { href: "/employer/register", label: t.nav.forEmployers },
    { href: "/register", label: t.nav.signUp },
    { href: "/login", label: t.nav.login },
  ];

  let roleLinks: { href: string; label: string }[] = [];

  if (user) {
    if (isStaffRole(user.role)) {
      roleLinks = [{ href: "/admin", label: t.nav.admin }];
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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.common.brand}
            </Link>
          </div>

          <nav
            aria-label={t.nav.primaryNavLabel}
            className="hidden items-center gap-2 lg:flex"
          >
            <ul className="flex items-center">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <HeaderNavLink href={link.href}>{link.label}</HeaderNavLink>
                </li>
              ))}
            </ul>

            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

            <ul className="flex items-center">
              {secondaryLinks.map((link) => (
                <li key={link.href}>
                  <HeaderNavLink href={link.href}>{link.label}</HeaderNavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher />
            <nav aria-label={t.nav.accountNavLabel}>
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
                          {t.nav.logOut}
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
                        {t.nav.forEmployers}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/login"
                        className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised hover:border-border shadow-sm hover:shadow-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {t.nav.login}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/register"
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover shadow-sm hover:shadow-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {t.nav.signUp}
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
