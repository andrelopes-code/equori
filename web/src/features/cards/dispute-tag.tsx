import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { disputesQuery } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";

// A purchase with a dispute still open says so on its line.
export function DisputeTag({ transactionId }: { transactionId: string }) {
  const t = useT();
  const disputes = useQuery(disputesQuery(useApi(), transactionId));
  const open =
    disputes.data?.items.some((d) => d.resolved_on === undefined) ?? false;
  return open ? (
    <Tag size="sm" tone="warning">
      {t("dispute.tag")}
    </Tag>
  ) : null;
}
