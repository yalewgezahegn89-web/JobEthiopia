import Link from "next/link";

export function EmployerCta() {
  return (
    <section
      aria-labelledby="employer-cta-heading"
      className="relative overflow-hidden bg-primary"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-10"
      >
        <svg
          className="absolute -right-10 -top-10 h-80 w-80"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M50 8 L62 38 L92 50 L62 62 L50 92 L38 62 L8 50 L38 38 Z"
            fill="white"
          />
        </svg>
      </div>
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 text-center sm:py-20">
        <h2
          id="employer-cta-heading"
          className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Are you hiring?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-primary-light sm:text-lg">
          Reach qualified candidates in Ethiopia with a dedicated employer
          account. Post roles, manage applications, and build your team.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/employer/register"
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-accent hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Create employer account
          </Link>
          <Link
            href="/jobs"
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Browse open roles
          </Link>
        </div>
      </div>
    </section>
  );
}
