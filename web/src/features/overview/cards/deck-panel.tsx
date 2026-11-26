import { CycleRail } from "@/features/overview/cards/cycle-rail";
import {
  deadlineTone,
  deadlineWords,
} from "@/features/overview/cards/deadline-words";
import { historyWords } from "@/features/overview/cards/history-words";
import type { WalletCard } from "@/features/overview/cards/wallet";
import { WalletFact } from "@/features/overview/cards/wallet-fact";
import { WalletLimit } from "@/features/overview/cards/wallet-limit";
import styles from "@/features/overview/cards/wallet.module.css";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface DeckPanelProps {
  card: WalletCard;
  scale: (currency: string) => number;
}

// The panel of one card: the rail of its open cycle, then what it owes and when, its open
// statement and its limit (CD6, CW7). The months engraved on its face stand here in words.
export function DeckPanel({ card, scale }: DeckPanelProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { account, owed, open } = card;
  const late = owed !== undefined && owed.deadline.kind !== "week";
  const urgent = late && owed.deadline.kind !== "date";
  const words = historyWords(card.history, locale, (m) =>
    fmt.money(m, scale(m.currency)),
  );

  return (
    <div className={styles.deckPanel} data-part="row">
      <CycleRail cycle={card.cycle} name={account.name} />

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

      {words !== undefined && (
        <span className={styles.deckHidden}>
          {t("overview.cards.trendLabel", { name: account.name, ...words })}
        </span>
      )}
    </div>
  );
}
