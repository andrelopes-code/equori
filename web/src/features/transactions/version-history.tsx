import { useQuery } from "@tanstack/react-query";
import { Timeline, TimelineItem } from "@slotted/react/timeline";

import { useApi } from "@/api/api-context";
import { versionsQuery } from "@/features/transactions/api";
import styles from "@/features/transactions/transaction-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

export function VersionHistory({ id }: { id: string }) {
  const t = useT();
  const versions = useQuery(versionsQuery(useApi(), id));
  return (
    <section className={styles.history}>
      <h2>{t("transaction.history.title")}</h2>
      {versions.isError ? (
        <QueryError
          error={versions.error}
          onRetry={() => void versions.refetch()}
        />
      ) : (
        <Timeline
          label={t("transaction.history.title")}
          loading={versions.isPending}
          empty={t("transaction.history.empty")}
        >
          {(versions.data ?? []).map((v) => (
            <TimelineItem
              key={v.version}
              title={t("transaction.history.version", {
                n: String(v.version),
              })}
              time={v.replaced_at}
              description={v.reason}
            />
          ))}
        </Timeline>
      )}
    </section>
  );
}
