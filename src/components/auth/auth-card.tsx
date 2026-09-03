import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/ui/brand-mark";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared polished authentication shell used by the login, forgot-password,
 * reset-password, and register pages. Renders the decorative geometry
 * background, the brand mark, an eyebrow badge, consistent heading typography,
 * supporting text, and an optional card footer with a divider.
 */
export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:py-20">
      <AuthGeometry />
      <div className="relative w-full max-w-md">
        <Card className="p-8 sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandMark size={48} />
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              {eyebrow}
            </p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          {children}
          {footer ? (
            <div className="mt-6 border-t border-border-subtle pt-6 text-center">
              {footer}
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}

function AuthGeometry() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <svg
        className="absolute -right-24 -top-24 h-[30rem] w-[30rem] text-primary/5"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="currentColor" strokeWidth="1">
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={`a-${i}`}
              x1={20 + i * 12}
              y1="0"
              x2={20 + i * 12}
              y2="200"
            />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={`b-${i}`}
              x1="0"
              y1={20 + i * 12}
              x2="200"
              y2={20 + i * 12}
            />
          ))}
        </g>
      </svg>
      <svg
        className="absolute -left-24 bottom-0 h-64 w-64 text-accent/10"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 8 L62 38 L92 50 L62 62 L50 92 L38 62 L8 50 L38 38 Z"
          fill="currentColor"
        />
        <path
          d="M50 26 L57 44 L75 50 L57 56 L50 74 L43 56 L25 50 L43 44 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
