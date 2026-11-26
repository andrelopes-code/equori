import { Text } from "@slotted/react/typography";

import {
  deadlineTone,
  deadlineWords,
} from "@/features/overview/cards/deadline-words";
import type { WalletView } from "@/features/overview/cards/wallet";
import styles from "@/features/overview/cards/wallet.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MoneyFigure } from "@/ui/money/money-figure";

const separator = " · ";

interface WalletTotalsProps {
  due: WalletView["due"];
  open: WalletView["open"];
  scale: (currency: string) => number;
}

// What every card owes and when, and what the open statements hold, in the base currency (CW6).
export function WalletTotals({ due, open, scale }: WalletTotalsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { deadline } = due;
  const base = open.amount.currency;
  const count = (n: number) =>
    n === 1
      ? t("overview.cards.statementsOne")
      : t("overview.cards.statements", {
          count: numberFormatter(locale).format(n),
        });
  const openNote =
    open.foreign > 0
      ? t("overview.cards.baseOnly", {
          currency: fmt.parts(open.amount, scale(base)).symbol,
        })
      : count(open.count);

  return (
    <div className={styles.summary}>
      <div className={styles.due} data-part="due">
        <Text size="sm" tone="muted">
          {t("overview.cards.dueAll")}
        </Text>

        {deadline === undefined && (
          <Text size="xl" weight="semibold">
            {t("overview.cards.nothingDue")}
          </Text>
        )}

        {deadline !== undefined && (
          <Text
            className={styles.roll}
            size="3xl"
            weight="semibold"
            numeric="tabular"
          >
            <MoneyFigure
              amount={due.amount.amount}
              currency={due.amount.currency}
              scale={scale(due.amount.currency)}
            />
          </Text>
        )}

        {deadline !== undefined && (
          <Text size="sm" tone={deadlineTone(deadline)} weight="medium">
            {count(due.count) + separator + deadlineWords(deadline, locale, t)}
          </Text>
        )}
      </div>

      <div className={styles.open} data-part="open">
        <Text size="sm" tone="muted">
          {t("overview.cards.openAll")}
        </Text>
        <Text
          className={styles.roll}
          size="lg"
          weight="semibold"
          numeric="tabular"
        >
          <MoneyFigure
            amount={open.amount.amount}
            currency={base}
            scale={scale(base)}
          />
        </Text>
        <Text size="sm" tone="muted">
          {openNote}
        </Text>
      </div>
    </div>
  );
}
