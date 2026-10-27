import { Card, CardBody } from "@slotted/react/card";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/planning/budget-plan.module.css";
import { planShare } from "@/features/planning/plan-math";
import { PlanFigure } from "@/features/planning/plan-figure";
import type { PlanFormat } from "@/features/planning/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";

type BudgetPlan = components["schemas"]["BudgetPlan"];
type Source = components["schemas"]["BudgetPlanSource"];

const sources: readonly Source[] = [
  "expected_income",
  "average_income",
  "fixed",
];

// The plan's question first (spec 5.1): what of the reference has no destination yet, the
// reference it is read against and where that reference comes from.
export function PlanReferencePanel({
  plan,
  source,
  fixed,
  reference,
  unassigned,
  committed,
  format,
  editable,
  compact,
  bar,
  onSource,
}: {
  plan: BudgetPlan;
  source: Source;
  fixed: number | undefined;
  reference: number | undefined;
  unassigned: number | undefined;
  // Installments, savings and the counted budgets.
  committed: number;
  format: PlanFormat;
  editable: boolean;
  compact: boolean;
  bar: ReactNode;
  onSource: (source: Source, fixed?: number) => void;
}) {
  const t = useT();
  const over = unassigned !== undefined && unassigned < 0;
  const available: Record<Source, boolean> = {
    expected_income: plan.expected_income !== undefined,
    average_income: plan.average_income !== undefined,
    fixed: true,
  };
  const share =
    reference === undefined || unassigned === undefined
      ? undefined
      : planShare(reference - unassigned, reference);
  const months = plan.average_months ?? 0;
  const breakdown =
    source === "expected_income" ? (
      (plan.expected_items ?? []).map((item) => (
        <Text key={item.schedule_id} size="sm" tone="muted" numeric="tabular">
          {item.description} {format.money(item.amount.amount)}
        </Text>
      ))
    ) : source === "average_income" ? (
      <Text size="sm" tone="muted">
        {months === 1
          ? t("plan.averageOfOne")
          : t("plan.averageOf", { count: String(months) })}
      </Text>
    ) : format.hidden ? (
      // entry() is never masked (ADR 018 P4): privacy shows the masked figure instead.
      <Text size="sm" tone="muted" numeric="tabular">
        {format.money(fixed ?? 0)}
      </Text>
    ) : (
      <div className={styles.fixed}>
        <MoneyInput
          size="field"
          aria-label={t("plan.fixedAmount")}
          value={fixed ?? 0}
          currency={plan.currency}
          scale={format.scale}
          sign="neutral"
          readOnly={!editable}
          onChange={(amount) => {
            onSource("fixed", amount);
          }}
        />
      </div>
    );
  return (
    <Card
      render={(props) => <section {...props} aria-label={t("plan.panel")} />}
      fill="outline"
    >
      <CardBody>
        <div className={styles.panel}>
          <div className={styles.answer}>
            <Text size="sm" tone="muted">
              {over ? t("plan.over") : t("plan.unassigned")}
            </Text>
            {unassigned === undefined ? (
              <Text
                size={compact ? "xl" : "3xl"}
                weight="semibold"
                tone="muted"
              >
                {t("plan.dash")}
              </Text>
            ) : (
              <PlanFigure
                amount={Math.abs(unassigned)}
                format={format.money}
                tone={over ? "danger" : "default"}
                size={compact ? "xl" : "3xl"}
              />
            )}
            <Text size="sm" tone={over ? "danger" : "muted"} numeric="tabular">
              {reference === undefined
                ? t("plan.noReference")
                : over
                  ? t("plan.leadOver", {
                      total: format.money(committed),
                      reference: format.money(reference),
                    })
                  : t("plan.lead", {
                      share: format.share(share) ?? t("plan.dash"),
                      month: format.month(plan.month),
                    })}
            </Text>
          </div>
          <div className={styles.source}>
            <SegmentedControl
              aria-label={t("plan.source")}
              size="sm"
              value={source}
              disabled={!editable}
              onValueChange={(value) => {
                const next = sources.find((s) => s === value);
                if (next !== undefined)
                  onSource(
                    next,
                    next === "fixed" ? (fixed ?? reference ?? 0) : undefined,
                  );
              }}
            >
              {sources.map((s) => (
                <Segment key={s} value={s} disabled={!available[s]}>
                  {t(`plan.source.${s}`)}
                </Segment>
              ))}
            </SegmentedControl>
            <div className={styles.breakdown}>
              {breakdown}
              {!available.expected_income && (
                <Text size="xs" tone="muted">
                  {t("plan.noExpected")}
                </Text>
              )}
              {!available.average_income && (
                <Text size="xs" tone="muted">
                  {t("plan.noAverage")}
                </Text>
              )}
              <Text size="xs" tone="muted" numeric="tabular">
                {t("plan.received", {
                  amount: format.money(plan.received_income.amount),
                })}
              </Text>
            </div>
          </div>
        </div>
        {bar}
      </CardBody>
    </Card>
  );
}
