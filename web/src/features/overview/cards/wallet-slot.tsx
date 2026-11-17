import { AccountFace } from "@/features/cards";
import { deadlineWords } from "@/features/overview/cards/deadline-words";
import type { WalletCard } from "@/features/overview/cards/wallet";
import { WalletDetail } from "@/features/overview/cards/wallet-detail";
import styles from "@/features/overview/cards/wallet.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MoneyFigure } from "@/ui/money/money-figure";

interface WalletSlotProps {
  card: WalletCard;
  // The name the radios of one wallet share.
  group: string;
  chosen: boolean;
  scale: (currency: string) => number;
}

// One card of the wallet: the radio that chooses it under its face, and its detail, drawn only
// while the radio is checked (CW3). A card that owes carries the amount on its strip (CW5).
export function WalletSlot({ card, group, chosen, scale }: WalletSlotProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { account, owed } = card;
  const label =
    owed === undefined
      ? t("overview.cards.cardClear", { name: account.name })
      : t("overview.cards.cardOwes", {
          name: account.name,
          amount: fmt.money(owed.amount, scale(owed.amount.currency)),
          deadline: deadlineWords(owed.deadline, locale, t),
        });

  return (
    <div className={styles.cardUnit}>
      <label className={styles.slot}>
        <input
          className={styles.pick}
          type="radio"
          name={group}
          defaultChecked={chosen}
          aria-label={label}
        />
        <span className={styles.slotFace} aria-hidden="true">
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
          />
        </span>
      </label>

      <WalletDetail card={card} scale={scale} />
    </div>
  );
}
