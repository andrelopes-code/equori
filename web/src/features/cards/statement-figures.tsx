import { Text } from "@slotted/react/typography";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { useMoneyFormat } from "@/privacy/use-money-format";
import type { MoneyAmount } from "@/ui/money-value";

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
  const fmt = useMoneyFormat();
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
  const figure = (m: components["schemas"]["Money"]): MoneyAmount => ({
    money: m,
    scale: scale(m.currency),
  });
  const institution = statement.institution;
  return (
    <Stack gap={3}>
      <FigureGrid label={t("statement.figures")}>
        <FigureCard
          label={t("statement.opening")}
          value={figure(statement.opening)}
          note={t("statement.openingNote")}
        />
        <FigureCard
          label={t("statement.charges")}
          value={figure(statement.charges)}
          note={t("statement.chargesNote")}
        />
        <FigureCard
          label={t("statement.credits")}
          value={figure(statement.credits)}
          note={t("statement.creditsNote")}
        />
        <FigureCard
          label={t("statement.payments")}
          value={figure(statement.payments)}
          note={t("statement.paymentsNote")}
        />
        <FigureCard
          label={t("statement.total")}
          value={figure(statement.amount_due)}
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
          value={figure(statement.unpaid)}
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
