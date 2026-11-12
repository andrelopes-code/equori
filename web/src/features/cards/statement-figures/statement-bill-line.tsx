import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/cards/statement-figures/statement-bill-line.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementDetail"];

interface Term {
  label:
    | "statement.opening"
    | "statement.charges"
    | "statement.credits"
    | "statement.payments"
    | "statement.total";
  field: "opening" | "charges" | "credits" | "payments" | "amount_due";
  operator: "statement.op.plus" | "statement.op.minus" | "statement.op.equals";
  // A term that is zero is left out with its operator (CA2); charges and the total are not.
  droppable: boolean;
}

interface StatementBillLineProps {
  statement: Statement;
  scale: (code: string) => number;
}

const TERMS: Term[] = [
  {
    label: "statement.opening",
    field: "opening",
    operator: "statement.op.plus",
    droppable: true,
  },
  {
    label: "statement.charges",
    field: "charges",
    operator: "statement.op.plus",
    droppable: false,
  },
  {
    label: "statement.credits",
    field: "credits",
    operator: "statement.op.minus",
    droppable: true,
  },
  {
    label: "statement.payments",
    field: "payments",
    operator: "statement.op.minus",
    droppable: true,
  },
  {
    label: "statement.total",
    field: "amount_due",
    operator: "statement.op.equals",
    droppable: false,
  },
];

// A89: the statement as one equation, previous balance plus purchases minus credits minus
// payments equals the total, with the institution's total under it.
export function StatementBillLine({
  statement,
  scale,
}: StatementBillLineProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const drawn = TERMS.filter(
    (term) => !term.droppable || statement[term.field].amount !== 0,
  );
  const institution = statement.institution;
  const difference = statement.amount_difference ?? {
    amount: 0,
    currency: institution?.total.currency ?? statement.amount_due.currency,
  };
  const note =
    institution === undefined
      ? t("statement.totalNote")
      : t("statement.institution", {
          total: fmt.money(
            institution.total,
            scale(institution.total.currency),
          ),
          difference: fmt.money(difference, scale(difference.currency)),
        });

  return (
    <Stack gap={2}>
      <div className={styles.line}>
        {drawn.map((term, index) => (
          <Fragment key={term.field}>
            {index > 0 && (
              <Text size="xl" tone="muted" className={styles.operator}>
                {t(term.operator)}
              </Text>
            )}

            <dl className={styles.term}>
              <dt>
                <Text size="sm" tone="muted">
                  {t(term.label)}
                </Text>
              </dt>
              <dd className={styles.figure}>
                <Text size="xl" weight="semibold" numeric="tabular">
                  {fmt.money(
                    statement[term.field],
                    scale(statement[term.field].currency),
                  )}
                </Text>
              </dd>
            </dl>
          </Fragment>
        ))}
      </div>

      <Text size="sm" tone="muted">
        {note}
      </Text>
    </Stack>
  );
}
