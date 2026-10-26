import { SkeletonText } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { AnalysisView } from "@/features/cards/analysis-view";
import { cardAnalyticsQuery } from "@/features/cards/api";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// The card's latest closed statements, each split as one statement is.
export function CardAnalysis({
  accountId,
  scale,
}: {
  accountId: string;
  scale: number;
}) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const analytics = useQuery(cardAnalyticsQuery(api, accountId));
  if (analytics.isError)
    return (
      <QueryError
        error={analytics.error}
        onRetry={() => void analytics.refetch()}
      />
    );
  if (analytics.isPending) return <SkeletonText lines={4} />;
  if (analytics.data.length === 0) return null;
  return (
    <AnalysisView
      title={t("analysis.card")}
      label={t("analysis.month")}
      orientation="vertical"
      scale={scale}
      rows={analytics.data.map((s) => ({
        ...s,
        key: s.statement_id,
        name: formatReferenceMonth(s.reference, locale),
      }))}
    />
  );
}
