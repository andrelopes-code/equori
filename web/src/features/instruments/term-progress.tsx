import { ProgressBar } from "@slotted/react/progress-indicator";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { maturityOf } from "@/features/instruments/maturity";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Terms = components["schemas"]["FixedIncomeTerms"];

// IP10: how much of the term has run, and the days to maturity or since it.
export function TermProgress({ terms }: { terms: Terms }) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const count = numberFormatter(locale);
  const m = maturityOf(terms.issued_on, terms.matures_on, today);

  return (
    <Stack gap={2}>
      <ProgressBar
        label={t("terms.progress")}
        value={m.percent}
        valueText={t("terms.progress.value", {
          elapsed: count.format(m.elapsedDays),
          total: count.format(m.totalDays),
        })}
        showValue
        tone={m.state === "matured" ? "secondary" : "accent"}
      />
      <Text size="sm" tone="muted">
        {t(maturityKey(m.state, m.days), { days: count.format(m.days) })}
      </Text>
    </Stack>
  );
}

function maturityKey(state: "upcoming" | "running" | "matured", days: number) {
  if (state === "matured" && days === 0) return "terms.maturity.today";

  const suffix = days === 1 ? "one" : "other";
  if (state === "matured") return `terms.maturity.matured.${suffix}` as const;
  if (state === "upcoming") return `terms.maturity.upcoming.${suffix}` as const;

  return `terms.maturity.running.${suffix}` as const;
}
