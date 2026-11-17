import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/overview/cards/wallet.module.css";
import { MoneyFigure } from "@/ui/money/money-figure";
import { routeTo } from "@/ui/navigation/route-to";

type Money = components["schemas"]["Money"];
type Statement = components["schemas"]["StatementSummary"];

const dash = "—";

interface WalletFactProps {
  label: string;
  note: string;
  tone: "danger" | "warning" | "muted";
  // The note of a deadline that asks for action takes the medium weight.
  strong?: boolean;
  // Undefined when the card has no such statement: the value reads a dash.
  amount: Money | undefined;
  statement: Statement | undefined;
  // The owed amount is the figure of the detail; the others keep the regular weight.
  emphasis?: boolean;
  scale: (currency: string) => number;
}

// A label, a note and an amount that opens its statement (CW7).
export function WalletFact({
  label,
  note,
  tone,
  strong = false,
  amount,
  statement,
  emphasis = false,
  scale,
}: WalletFactProps) {
  const known = amount !== undefined && statement !== undefined;

  return (
    <div className={styles.fact}>
      <dt>
        <Text size="sm" tone="muted">
          {label}
        </Text>
      </dt>
      <dd className={styles.factNote}>
        <Text
          size="sm"
          tone={tone}
          {...(strong ? { weight: "medium" as const } : {})}
        >
          {note}
        </Text>
      </dd>
      <dd className={styles.factValue}>
        {!known && <Text tone="muted">{dash}</Text>}

        {known &&
          routeTo({
            to: "/cards/$accountId/statements/$statementId",
            params: {
              accountId: statement.account_id,
              statementId: statement.id,
            },
          })({
            className: styles.valueLink,
            children: (
              <Text
                numeric="tabular"
                {...(emphasis ? { weight: "semibold" as const } : {})}
              >
                <MoneyFigure
                  amount={amount.amount}
                  currency={amount.currency}
                  scale={scale(amount.currency)}
                />
              </Text>
            ),
          })}
      </dd>
    </div>
  );
}
