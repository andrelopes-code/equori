import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import type { Consequence } from "@/features/transactions/account-consequence";
import styles from "@/features/transactions/consequence-sentence.module.css";
import { formatDayMonthLong } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";
import { withValue } from "@/ui/with-value";

type Account = components["schemas"]["Account"];

// The sentence under the account field: what the chosen account does with the amount, its key
// figure marked. A live region, so a change of account is read out.
export function ConsequenceSentence({
  id,
  account,
  consequence,
  scale,
}: {
  id: string;
  account: Account | undefined;
  consequence: Consequence | null;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const warning = consequence?.kind === "balance" && consequence.warning;
  const key = (value: ReactNode) => (
    <strong className={styles.key} data-warning={warning || undefined}>
      {value}
    </strong>
  );
  const sentence =
    account === undefined || consequence === null
      ? null
      : consequence.kind === "statement"
        ? withValue(
            t("accountChoice.sentence.statement"),
            "{value}",
            key(formatDayMonthLong(consequence.dueDate, locale)),
          )
        : withValue(
            t(
              consequence.kind === "limit"
                ? "accountChoice.sentence.limit"
                : consequence.reserve
                  ? "accountChoice.sentence.reserve"
                  : "accountChoice.sentence.balance",
            ),
            "{value}",
            key(
              <MoneyFigure
                amount={consequence.after}
                currency={account.currency}
                scale={scale}
              />,
            ),
          );
  return (
    <p id={id} role="status" className={styles.sentence}>
      {sentence}
    </p>
  );
}
