import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

import type { components } from "@/api/schema.gen";
import styles from "@/features/categories/coverage.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Statistics = components["schemas"]["CategorizationStatistics"];

// SC5: how the month's transactions got their categories, automatic first.
export function Coverage({
  statistics,
  loading,
}: {
  statistics: Statistics | undefined;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const s = statistics;
  const automatic = s === undefined ? 0 : s.rule + s.history + s.source;
  const share =
    s === undefined || s.total === 0
      ? undefined
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(automatic / s.total);
  const count = (n: number | undefined) =>
    n === undefined ? undefined : new Intl.NumberFormat(locale).format(n);
  const tiles: { label: string; value: string | undefined; note?: string }[] = [
    {
      label: t("coverage.automatic"),
      value: share,
      note: t("coverage.automaticNote", {
        rule: s?.rule ?? 0,
        history: s?.history ?? 0,
        source: s?.source ?? 0,
      }),
    },
    { label: t("coverage.manual"), value: count(s?.manual) },
    { label: t("coverage.uncategorized"), value: count(s?.uncategorized) },
    { label: t("coverage.total"), value: count(s?.total) },
  ];
  return (
    <div className={styles.grid}>
      {tiles.map((tile) => (
        <StatCard
          key={tile.label}
          size="sm"
          loading={loading}
          status={!loading && tile.value === undefined ? "empty" : "ready"}
        >
          <StatCardHeader>
            <StatCardLabel>{tile.label}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue value={tile.value} />
            {tile.note !== undefined && (
              <StatCardComparison>{tile.note}</StatCardComparison>
            )}
          </StatCardFigure>
        </StatCard>
      ))}
    </div>
  );
}
