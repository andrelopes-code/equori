import { Text } from "@slotted/react/typography";

import {
  deadlineTone,
  deadlineWords,
} from "@/features/overview/cards/deadline-words";
import type { WalletCard } from "@/features/overview/cards/wallet";
import { WalletFact } from "@/features/overview/cards/wallet-fact";
import { WalletLimit } from "@/features/overview/cards/wallet-limit";
import styles from "@/features/overview/cards/wallet.module.css";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface WalletDetailProps {
  card: WalletCard;
  scale: (currency: string) => number;
}

// The three facts of one card: what it owes and when, its open statement and its limit (CW7).
export function WalletDetail({ card, scale }: WalletDetailProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const { account, owed, open } = card;
  const late = owed !== undefined && owed.deadline.kind !== "week";
  const urgent = late && owed.deadline.kind !== "date";

  return (
    <div className={styles.cardDetail} data-part="row">
      <Text className={styles.cardName} weight="semibold">
        {account.name}
      </Text>

      <dl className={styles.facts}>
        <WalletFact
          label={t("overview.cards.pay")}
          note={
            owed === undefined
              ? t("overview.cards.nothing")
              : deadlineWords(owed.deadline, locale, t)
          }
          tone={owed === undefined ? "muted" : deadlineTone(owed.deadline)}
          strong={urgent}
          amount={owed?.amount}
          statement={owed?.statement}
          emphasis
          scale={scale}
        />

        <WalletFact
          label={t("overview.cards.bill")}
          note={
            open === undefined
              ? t("overview.cards.noBill")
              : t("overview.cards.closes", {
                  date: formatDayMonthNumeric(open.closing_date, locale),
                })
          }
          tone="muted"
          amount={open?.open_amount}
          statement={open}
          scale={scale}
        />

        <WalletLimit limit={card.limit} scale={scale} />
      </dl>
    </div>
  );
}
