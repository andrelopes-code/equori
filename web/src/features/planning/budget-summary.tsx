import { Card, CardBody, CardHeader } from "@slotted/react/card";
import { ProgressBar } from "@slotted/react/progress-indicator";
import { SkeletonText } from "@slotted/react/skeleton";
import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { BudgetState, Figures } from "@/features/planning/budget-month";
import { budgetState, usedShare } from "@/features/planning/budget-month";
import styles from "@/features/planning/budgets.module.css";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];
type Committed = components["schemas"]["Committed"];
type Price = components["schemas"]["Price"];

const tones = { over: "danger", near: "warning", within: "secondary" } as const;
const meterTones = {
  over: "danger",
  near: "warning",
  within: "accent",
} as const;

// CP-04, after goal-card: the month over every budget, how far into the month the reader is, and
// what installments and expected occurrences still commit. On a phone it keeps the figure, the bar
// and one line of each, so the budgets start on the first screen (M2).
export function BudgetSummary({
  figures,
  states,
  committed,
  elapsed,
  scale,
  compact,
}: {
  // Undefined while the budgets load.
  figures: Figures | undefined;
  states: Record<BudgetState, number>;
  committed: Committed | undefined;
  // Days gone and days of the month, for the month in course only.
  elapsed: { day: number; days: number } | undefined;
  scale: (code: string) => number;
  compact: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const percent = (share: number) =>
    numberFormatter(locale, { style: "percent" }).format(share / 100);
  const rate = (p: Price) =>
    t("budget.price", {
      instrument: p.instrument,
      rate: numberFormatter(locale, {
        minimumFractionDigits: p.value.split(".")[1]?.length ?? 0,
      }).format(Number(p.value)),
      quote: p.quote_instrument,
      date: formatDate(p.date, locale),
    });
  const state = figures === undefined ? "within" : budgetState(figures);
  const counts = [
    ["over", states.over, "budget.overOne", "budget.overMany"],
    ["near", states.near, "budget.nearOne", "budget.nearMany"],
    ["within", states.within, "budget.withinOne", "budget.withinMany"],
  ] as const;
  const share = figures === undefined ? 0 : usedShare(figures);
  return (
    <Card
      render={(props) => (
        <section {...props} aria-label={t("budget.summary")} />
      )}
      fill="outline"
    >
      {!compact && (
        <CardHeader>
          <Heading level={3} size="md">
            {t("budget.summary")}
          </Heading>
        </CardHeader>
      )}
      <CardBody>
        {figures === undefined ? (
          <SkeletonText lines={4} />
        ) : (
          <div className={styles.progress} data-state={state}>
            <div className={styles.spent}>
              <div className={styles.spentText}>
                <Text size="sm" tone="muted">
                  {t("budget.spentInMonth")}
                </Text>
                <Text
                  size={compact ? "xl" : "2xl"}
                  weight="semibold"
                  numeric="tabular"
                >
                  {money(figures.spent)}
                </Text>
                <Text size="sm" tone="muted" numeric="tabular">
                  {t("budget.ofRoom", {
                    room: money({
                      ...figures.planned,
                      amount: figures.planned.amount + figures.carried.amount,
                    }),
                  })}
                </Text>
              </div>
              <Text
                size="xl"
                weight="semibold"
                numeric="tabular"
                className={styles.percent}
                aria-hidden="true"
              >
                {percent(share)}
              </Text>
            </div>
            <ProgressBar
              size="lg"
              hideLabel
              label={t("budget.summaryMeter")}
              value={share}
              tone={meterTones[state]}
            />
            <div className={styles.statusRow}>
              <Text
                size="sm"
                weight="medium"
                tone={state === "over" ? "danger" : "default"}
                numeric="tabular"
              >
                {state === "over"
                  ? t("budget.over", {
                      amount: money({
                        ...figures.available,
                        amount: -figures.available.amount,
                      }),
                    })
                  : t("budget.left", { amount: money(figures.available) })}
              </Text>
              {elapsed !== undefined && (
                <Text size="sm" tone="muted" numeric="tabular">
                  {t("budget.day", {
                    day: String(elapsed.day),
                    days: String(elapsed.days),
                  })}
                </Text>
              )}
            </div>
            {!compact && states.over + states.near + states.within > 0 && (
              <Inline gap={4} wrap="wrap">
                {counts.map(([state, count, one, many]) =>
                  count === 0 ? null : (
                    <Tag key={state} tone={tones[state]} size="sm">
                      {count === 1 ? t(one) : t(many, { count: String(count) })}
                    </Tag>
                  ),
                )}
              </Inline>
            )}
          </div>
        )}
        {committed === undefined ? (
          <div className={styles.committed}>
            <SkeletonText lines={1} />
          </div>
        ) : (
          <>
            <dl className={styles.committed}>
              {(
                [
                  ["budget.committedTotal", committed.total],
                  ["budget.installments", committed.installments],
                  ["budget.expected", committed.occurrences],
                ] as const
              ).map(([key, value], index) => (
                <div key={key} className={styles.figure}>
                  <Text
                    size="xs"
                    tone="muted"
                    render={(props) => <dt {...props} />}
                  >
                    {t(key)}
                  </Text>
                  <Text
                    size={index === 0 ? "md" : "sm"}
                    weight={index === 0 ? "semibold" : "medium"}
                    numeric="tabular"
                    className={styles.value}
                    render={(props) => <dd {...props} />}
                  >
                    {money(value)}
                  </Text>
                </div>
              ))}
            </dl>
            {(committed.prices ?? []).map((p) => (
              <Text key={`${p.instrument}-${p.date}`} size="xs" tone="muted">
                {rate(p)}
              </Text>
            ))}
          </>
        )}
      </CardBody>
    </Card>
  );
}
