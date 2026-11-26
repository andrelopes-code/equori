import type { CSSProperties } from "react";

import { AccountFace, useAccountAppearance } from "@/features/cards";
import { DeckPanel } from "@/features/overview/cards/deck-panel";
import { deadlineWords } from "@/features/overview/cards/deadline-words";
import { FaceTrend } from "@/features/overview/cards/face-trend";
import type { WalletCard } from "@/features/overview/cards/wallet";
import styles from "@/features/overview/cards/wallet.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MoneyFigure } from "@/ui/money/money-figure";

interface DeckCardProps {
  card: WalletCard;
  // The name the radios of one deck share.
  group: string;
  chosen: boolean;
  // The place of the card in the deck, from the back.
  place: number;
  scale: (currency: string) => number;
}

// One card of the deck: its light, the radio that chooses it over its face and its panel,
// drawn only while the radio is checked (CD2, CD3). A card that owes carries the amount on its
// strip (CW5); its face carries its months (CD5) and the sweep of light of CD10.
export function DeckCard({ card, group, chosen, place, scale }: DeckCardProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { appearance } = useAccountAppearance(card.account);

  const { account, owed } = card;
  const label =
    owed === undefined
      ? t("overview.cards.cardClear", { name: account.name })
      : t("overview.cards.cardOwes", {
          name: account.name,
          amount: fmt.money(owed.amount, scale(owed.amount.currency)),
          deadline: deadlineWords(owed.deadline, locale, t),
        });
  const style = {
    "--k": String(place),
    "--card-face-color": appearance.color,
  } as CSSProperties;

  return (
    <div className={styles.deckUnit} style={style}>
      <span className={styles.deckGlow} aria-hidden="true" />

      <label className={styles.deckCard}>
        <input
          className={styles.deckPick}
          type="radio"
          name={group}
          defaultChecked={chosen}
          aria-label={label}
        />
        <span className={styles.deckFront} aria-hidden="true">
          <AccountFace
            account={account}
            note={
              owed === undefined ? undefined : (
                <span className={styles.stripNote}>
                  <MoneyFigure
                    amount={owed.amount.amount}
                    currency={owed.amount.currency}
                    scale={scale(owed.amount.currency)}
                  />
                </span>
              )
            }
            inset={
              <>
                <FaceTrend history={card.history} />
                <span className={styles.deckSheen} />
              </>
            }
          />
        </span>
      </label>

      <DeckPanel card={card} scale={scale} />
    </div>
  );
}
