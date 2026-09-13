import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/lib/applications/dal";

export type ApplicationStatusMeta = {
  label: string;
  variant: BadgeVariant;
  description: string;
  tone: "active" | "terminal";
};

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  ApplicationStatusMeta
> = {
  SUBMITTED: {
    label: "Submitted",
    variant: "info",
    description: "Your application has been received.",
    tone: "active",
  },
  REVIEWING: {
    label: "Reviewing",
    variant: "warning",
    description: "Your application is being reviewed.",
    tone: "active",
  },
  SHORTLISTED: {
    label: "Shortlisted",
    variant: "success",
    description: "You have been shortlisted for this role.",
    tone: "active",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive",
    description: "This application has been closed as rejected.",
    tone: "terminal",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    variant: "default",
    description: "You withdrew this application.",
    tone: "terminal",
  },
};

type I18nT = (key: string) => string;

export function getStatusLabel(status: ApplicationStatus, t?: I18nT): string {
  if (t) {
    return t(`applications.status.${status}`);
  }
  return APPLICATION_STATUS_META[status].label;
}

export function getStatusDescription(
  status: ApplicationStatus,
  t?: I18nT,
): string {
  if (t) {
    return t(`applications.status.description${status.charAt(0)}${status.slice(1).toLowerCase()}`);
  }
  return APPLICATION_STATUS_META[status].description;
}

export function ApplicationStatusBadge({
  status,
  className = "",
  label,
}: {
  status: ApplicationStatus;
  className?: string;
  label?: string;
}) {
  const meta = APPLICATION_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className}>
      {label ?? meta.label}
    </Badge>
  );
}
