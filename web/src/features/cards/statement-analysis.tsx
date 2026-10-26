import { SkeletonText } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { AnalysisView } from "@/features/cards/analysis-view";
import { statementAnalyticsQuery } from "@/features/cards/api";
import { useCategoryEntries } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// What a statement bills per category, split by the part each amount belongs to.
export function StatementAnalysis({
  accountId,
  statementId,
  scale,
}: {
  accountId: string;
  statementId: string;
  scale: number;
}) {
  const t = useT();
  const api = useApi();
  const analytics = useQuery(
    statementAnalyticsQuery(api, accountId, statementId),
  );
  const entries = useCategoryEntries(useQuery(accountsQuery(api)).data);
  if (analytics.isError)
    return (
      <QueryError
        error={analytics.error}
        onRetry={() => void analytics.refetch()}
      />
    );
  if (analytics.isPending) return <SkeletonText lines={4} />;
  if (analytics.data.categories.length === 0) return null;
  const paths = new Map(entries.map((e) => [e.id, e.path]));
  return (
    <AnalysisView
      title={t("analysis.statement")}
      label={t("analysis.category")}
      orientation="horizontal"
      scale={scale}
      rows={analytics.data.categories.map((c) => ({
        ...c,
        key: c.category_id,
        name: paths.get(c.category_id) ?? "",
      }))}
    />
  );
}
