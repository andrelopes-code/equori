import { Text } from "@slotted/react/typography";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

type Statement = components["schemas"]["StatementSummary"];

// The statement's terms and the sentence that adds them up (A89): what was owed before, what was
// charged, credited and paid on it, the total and what is still open.
export function StatementFigures({
  statement,
  scale,
}: {
  statement: Statement;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const money = (m: components["schemas"]["Money"]) =>
    formatMoney(m, scale(m.currency), locale);
  const institution = statement.institution;
  return (
    <Stack gap={3}>
      <FigureGrid label={t("statement.figures")}>
        <FigureCard
          label={t("statement.opening")}
          value={money(statement.opening)}
          note={t("statement.openingNote")}
        />
        <FigureCard
          label={t("statement.charges")}
          value={money(statement.charges)}
          note={t("statement.chargesNote")}
        />
        <FigureCard
          label={t("statement.credits")}
          value={money(statement.credits)}
          note={t("statement.creditsNote")}
        />
        <FigureCard
          label={t("statement.payments")}
          value={money(statement.payments)}
          note={t("statement.paymentsNote")}
        />
        <FigureCard
          label={t("statement.total")}
          value={money(statement.amount_due)}
          note={
            institution === undefined
              ? t("statement.totalNote")
              : t("statement.institution", {
                  total: money(institution.total),
                  difference: money(
                    statement.amount_difference ?? {
                      amount: 0,
                      currency: institution.total.currency,
                    },
                  ),
                })
          }
        />
        <FigureCard
          label={t("statement.unpaid")}
          value={money(statement.unpaid)}
          note={
            institution?.minimum === undefined
              ? t("statement.unpaidNote")
              : t("statement.minimum", { amount: money(institution.minimum) })
          }
        />
      </FigureGrid>
      <Text size="sm" tone="muted">
        {t("statement.breakdown", {
          opening: money(statement.opening),
          charges: money(statement.charges),
          credits: money(statement.credits),
          payments: money(statement.payments),
          total: money(statement.amount_due),
        })}
      </Text>
    </Stack>
  );
}
