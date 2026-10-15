import { type HTMLAttributes, forwardRef } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-raised text-muted border border-border-subtle",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  destructive: "bg-destructive-light text-destructive",
  info: "bg-primary-light text-primary",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className = "", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantStyles[variant]} ${className}`}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";
