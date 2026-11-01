import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementDetail"];

interface AwaitingNoteProps {
  statement: Statement;
  scale: (code: string) => number;
}

// A170: what of the statement's activity the bank confirmed and what still waits for it.
export function AwaitingNote({ statement, scale }: AwaitingNoteProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const { confirmed_amount: confirmed, awaiting_amount: awaiting } = statement;
  if (confirmed === undefined || awaiting === undefined) return null;
  if (awaiting.amount === 0) return null;

  return (
    <Text size="sm" tone="muted">
      {t("statement.awaiting", {
        confirmed: fmt.money(confirmed, scale(confirmed.currency)),
        awaiting: fmt.money(awaiting, scale(awaiting.currency)),
      })}
    </Text>
  );
}
