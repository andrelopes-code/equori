import { Link } from "@slotted/react/link";
import {
  StatCard,
  StatCardAction,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";
import { useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import styles from "@/features/categories/coverage.module.css";
import { formatMonthName, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Statistics = components["schemas"]["CategorizationStatistics"];

// SC5: how the month's transactions got their categories, automatic first. Every card has
// the same three lines — a short label, the figure and what the figure counts — so the row
// reads as one measure split four ways.
export function Coverage({
  statistics,
  loading,
  month,
}: {
  statistics: Statistics | undefined;
  loading: boolean;
  // YYYY-MM of the period the statistics cover.
  month: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const s = statistics;
  const automatic = s === undefined ? 0 : s.rule + s.history + s.source;
  const share =
    s === undefined || s.total === 0
      ? undefined
      : numberFormatter(locale, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(automatic / s.total);
  const count = (n: number | undefined) =>
    n === undefined ? undefined : numberFormatter(locale).format(n);
  const tiles: {
    key: string;
    label: string;
    value: string | undefined;
    note: string;
    review?: boolean;
  }[] = [
    {
      key: "automatic",
      label: t("coverage.automatic"),
      value: share,
      note: t("coverage.automaticNote", {
        rule: s?.rule ?? 0,
        history: s?.history ?? 0,
        source: s?.source ?? 0,
      }),
    },
    {
      key: "manual",
      label: t("coverage.manual"),
      value: count(s?.manual),
      note: t("coverage.manualNote"),
    },
    {
      key: "uncategorized",
      label: t("coverage.uncategorized"),
      value: count(s?.uncategorized),
      note: t("coverage.uncategorizedNote"),
      review: (s?.uncategorized ?? 0) > 0,
    },
    {
      key: "total",
      label: t("coverage.total"),
      value: count(s?.total),
      note: t("coverage.totalNote", {
        month: formatMonthName(month, locale).toLocaleLowerCase(locale),
      }),
    },
  ];
  return (
    <div className={styles.grid}>
      {tiles.map((tile) => (
        <StatCard
          key={tile.key}
          size="sm"
          layout="stacked"
          loading={loading}
          status={!loading && tile.value === undefined ? "empty" : "ready"}
        >
          <StatCardHeader>
            <StatCardLabel>{tile.label}</StatCardLabel>
            {tile.review === true && (
              <StatCardAction>
                <Link
                  href="/transactions?uncategorized=true"
                  onClick={(event) => {
                    event.preventDefault();
                    void navigate({
                      to: "/transactions",
                      search: { uncategorized: true },
                    });
                  }}
                >
                  {t("coverage.review")}
                </Link>
              </StatCardAction>
            )}
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue value={tile.value} />
          </StatCardFigure>
          <StatCardComparison>{tile.note}</StatCardComparison>
        </StatCard>
      ))}
    </div>
  );
}
