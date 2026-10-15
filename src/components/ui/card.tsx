import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = false, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-xl border border-border bg-surface shadow-sm ${hover ? "transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer" : ""} ${className}`}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";
