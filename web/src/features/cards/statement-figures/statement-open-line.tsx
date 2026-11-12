import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementDetail"];

interface StatementOpenLineProps {
  statement: Statement;
  scale: (code: string) => number;
}

// The part of the total the payments after closing have not covered, written once under the bill
// line (CA3). A statement with nothing paid after closing and not overdue draws nothing.
export function StatementOpenLine({
  statement,
  scale,
}: StatementOpenLineProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const overdue = statement.status === "overdue";
  if (statement.unpaid.amount === statement.amount_due.amount && !overdue) {
    return null;
  }

  const minimum = statement.institution?.minimum;
  const minimumNote =
    minimum === undefined
      ? t("statement.unpaidNote")
      : t("statement.minimum", {
          amount: fmt.money(minimum, scale(minimum.currency)),
        });
  const note = overdue
    ? t("statement.overdueSince", {
        date: formatDate(statement.due_date, locale),
      })
    : minimumNote;

  return (
    <Text size="sm" tone={overdue ? "danger" : "muted"}>
      {t("statement.unpaidLine", {
        label: t("statement.unpaid"),
        amount: fmt.money(statement.unpaid, scale(statement.unpaid.currency)),
        note,
      })}
    </Text>
  );
}
