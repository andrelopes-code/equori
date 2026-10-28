import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Slider } from "@slotted/react/slider";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { goalLine, type Goal } from "@/features/goals/goal-line";
import { defaultMonthly, monthlyRange } from "@/features/goals/goal-plan";
import { monthsBetween } from "@/features/goals/goal-plan";
import { formatReferenceMonth, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The monthly what-if of a goal: the amount set aside each month decides the month it completes.
export function GoalWhatIf({
  goal,
  scale,
  scheduled,
  investing,
}: {
  goal: Goal;
  scale: number;
  // The aporte already scheduled into the goal, in minor units per month; zero when none.
  scheduled: number;
  // Whether the goal holds an investment, which can earn a return.
  investing: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();
  const unit = 10 ** scale;
  const [major, setMajor] = useState(
    () =>
      defaultMonthly(today, goal.due_on, goal.remaining.amount, unit) / unit,
  );
  const [percent, setPercent] = useState(0);
  const trailing = goal.trailing_return;
  const line = goalLine(goal, major, scale, today, percent);
  const months =
    line.ready === null
      ? 0
      : monthsBetween(goal.due_on.slice(0, 7), line.ready);
  return (
    <Stack gap={3}>
      <Field size="sm">
        <Inline justify="between" align="baseline" gap={3}>
          <FieldLabel>{t("goals.monthly")}</FieldLabel>
          <Text size="sm" weight="medium">
            {fmt.money(
              { amount: major * unit, currency: goal.target.currency },
              scale,
            )}
          </Text>
        </Inline>
        <Slider
          value={major}
          min={monthlyRange.min}
          max={monthlyRange.max}
          step={monthlyRange.step}
          valueLabel="none"
          onValueChange={(next) => {
            if (typeof next === "number") setMajor(next);
          }}
        />
      </Field>
      {scheduled > 0 && (
        <Inline justify="between" gap={3}>
          <Text size="sm" tone="muted">
            {t("goals.scheduled", {
              amount: fmt.money(
                { amount: scheduled, currency: goal.target.currency },
                scale,
              ),
            })}
          </Text>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={() => {
              const stepped =
                Math.round(scheduled / unit / monthlyRange.step) *
                monthlyRange.step;
              setMajor(
                Math.min(monthlyRange.max, Math.max(monthlyRange.min, stepped)),
              );
            }}
          >
            {t("goals.useScheduled")}
          </Button>
        </Inline>
      )}
      {investing && (
        <Field size="sm">
          <Inline justify="between" align="baseline" gap={3}>
            <FieldLabel>{t("goals.return")}</FieldLabel>
            <Text size="sm" weight="medium">
              {numberFormatter(locale, {
                style: "percent",
                maximumFractionDigits: 1,
              }).format(percent / 100)}
            </Text>
          </Inline>
          {trailing !== undefined && (
            <Inline justify="between" gap={3}>
              <Text size="sm" tone="muted">
                {t("goals.trailing", {
                  months: trailing.period_months,
                  rate: numberFormatter(locale, {
                    style: "percent",
                    maximumFractionDigits: 1,
                  }).format(trailing.annual_bp / 10000),
                })}
              </Text>
              <Button
                size="sm"
                variant="outline"
                tone="secondary"
                onClick={() => {
                  setPercent(
                    Math.min(
                      20,
                      Math.max(0, Math.round(trailing.annual_bp / 50) / 2),
                    ),
                  );
                }}
              >
                {t("goals.useTrailing")}
              </Button>
            </Inline>
          )}
          <Slider
            value={percent}
            min={0}
            max={20}
            step={0.5}
            valueLabel="none"
            onValueChange={(next) => {
              if (typeof next === "number") setPercent(next);
            }}
          />
        </Field>
      )}
      {line.ready !== null && (
        <Tag tone={line.late ? "warning" : "success"} size="sm">
          {line.late
            ? t(months === 1 ? "goals.ready.lateOne" : "goals.ready.late", {
                month: formatReferenceMonth(line.ready, locale),
                count: months,
              })
            : t("goals.ready.onTime", {
                month: formatReferenceMonth(line.ready, locale),
              })}
        </Tag>
      )}
    </Stack>
  );
}
