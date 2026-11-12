import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import type { Consequence } from "@/features/transactions/account-field/account-consequence";
import styles from "@/features/transactions/account-field/consequence-sentence.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDayMonthLong } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";
import { withValue } from "@/ui/display/with-value";

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
  const warning =
    consequence?.kind === "overdraw" || consequence?.kind === "reserve";
  const key = (value: ReactNode) => (
    <strong className={styles.key} data-warning={warning || undefined}>
      {value}
    </strong>
  );
  const figure =
    account === undefined || consequence === null
      ? null
      : valueOf(consequence, account, scale, locale);
  const sentence =
    consequence === null || figure === null
      ? null
      : withValue(t(sentenceKey(consequence)), "{value}", key(figure));
  return (
    <p id={id} role="status" className={styles.sentence}>
      {sentence}
    </p>
  );
}

function sentenceKey(consequence: Consequence): MessageKey {
  switch (consequence.kind) {
    case "overdraw":
      return "accountChoice.sentence.balance";
    case "reserve":
      return "accountChoice.sentence.reserve";
    case "statement":
      return "accountChoice.sentence.statement";
    case "settles":
      return "accountChoice.sentence.settles";
  }
}

function valueOf(
  consequence: Consequence,
  account: Account,
  scale: number,
  locale: string,
): ReactNode {
  if (consequence.kind === "statement" || consequence.kind === "settles") {
    return formatDayMonthLong(consequence.dueDate, locale);
  }

  return (
    <MoneyFigure
      amount={consequence.after}
      currency={account.currency}
      scale={scale}
    />
  );
}
