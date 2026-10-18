import { Tag } from "@slotted/react/tag";

import { statusTone } from "@/features/cards/status-tone";
import type { Statement } from "@/features/cards/statement-groups";
import { useT } from "@/i18n/i18n-provider";

const tagTones = {
  neutral: "secondary",
  info: "accent",
  warning: "warning",
  danger: "danger",
  success: "success",
} as const;

export function StatementStatusTag({
  status,
}: {
  status: Statement["status"];
}) {
  const t = useT();
  return (
    <Tag tone={tagTones[statusTone(status)]} size="sm">
      {t(`cards.status.${status}`)}
    </Tag>
  );
}
