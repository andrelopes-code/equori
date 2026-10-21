import { InlineMessage } from "@slotted/react/inline-message";
import { Timeline, TimelineItem } from "@slotted/react/timeline";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { versionsQuery } from "@/features/transactions/api";
import { useT } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

// Each correction keeps the version it replaced; the list reads newest first.
export function HistorySection({ transaction }: { transaction: Transaction }) {
  const t = useT();
  const api = useApi();
  const versions = useQuery(versionsQuery(api, transaction.id));
  if (versions.isError) {
    return (
      <InlineMessage tone="danger">
        {errorText(versions.error, t)}
      </InlineMessage>
    );
  }
  const items = [...(versions.data ?? [])].sort(
    (a, b) => b.version - a.version,
  );
  return (
    <Timeline
      label={t("history.label")}
      order="newest-first"
      size="sm"
      loading={versions.isPending}
    >
      {transaction.voided_at !== undefined && (
        <TimelineItem
          title={t("history.voided")}
          description={transaction.void_reason}
          time={transaction.voided_at}
          tone="danger"
        />
      )}
      <TimelineItem
        title={t("history.current", { version: transaction.version })}
        current={transaction.voided_at === undefined}
      />
      {items.map((item) => (
        <TimelineItem
          key={item.version}
          title={t("history.replaced", { version: item.version })}
          description={item.reason || t("history.noReason")}
          time={item.replaced_at}
        />
      ))}
    </Timeline>
  );
}
