import { Badge } from "@slotted/react/badge";

import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type Status = components["schemas"]["StatementSummary"]["status"];

const badges: Record<
  Status,
  {
    label: MessageKey;
    tone: "accent" | "secondary" | "success" | "warning" | "danger";
  }
> = {
  open: { label: "admin.status.open", tone: "accent" },
  closed: { label: "admin.status.closed", tone: "warning" },
  paid: { label: "admin.status.paid", tone: "success" },
  partially_paid: { label: "admin.status.partially_paid", tone: "warning" },
  overdue: { label: "admin.status.overdue", tone: "danger" },
  financed: { label: "admin.status.financed", tone: "secondary" },
};

export function StatementBadge({ status }: { status: Status }) {
  const t = useT();
  const { label, tone } = badges[status];
  return (
    <Badge tone={tone} size="sm">
      {t(label)}
    </Badge>
  );
}
