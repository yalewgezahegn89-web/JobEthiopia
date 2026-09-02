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

export function ApplicationStatusBadge({
  status,
  className = "",
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const meta = APPLICATION_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}