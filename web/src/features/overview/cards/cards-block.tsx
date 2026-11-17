import { useId } from "react";

import { WalletSlot } from "@/features/overview/cards/wallet-slot";
import { WalletTotals } from "@/features/overview/cards/wallet-totals";
import styles from "@/features/overview/cards/wallet.module.css";
import { useWallet } from "@/features/overview/cards/use-wallet";
import { useWalletFit } from "@/features/overview/cards/use-wallet-fit";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block/overview-block";
import { useT } from "@/i18n/i18n-provider";

// Families read: radio-group, card, carousel, accordion. A radio group draws a mark and a label
// per option; a card is a surface for content; a carousel keeps one item in view; an accordion
// draws a header and a panel per item. The wallet stacks the faces of the cards, pulls the
// chosen one out whole and details it (docs/specs/2026-11-17-overview-cards-design.md, CW13).
// The choice is a radio group and the layout answers it through :has(), so the block holds no
// state. It is a form of this widget, not a Slotted finding.
export function CardsBlock(placement: Placement) {
  const t = useT();
  const group = useId();
  const { view, scale, error, retry } = useWallet();

  const [fit, wallet] = useWalletFit(view?.cards.length ?? 0);

  const loaded = view !== undefined && scale !== null;
  const empty = loaded && view.cards.length === 0;

  return (
    <OverviewBlock
      placement={placement}
      link={{ label: t("overview.cards.open"), options: { to: "/cards" } }}
      loading={!loaded && error === null}
      error={error}
      onRetry={retry}
      empty={empty ? t("overview.cards.empty") : undefined}
    >
      {loaded && !empty && (
        <div className={styles.wallet} data-part="cards" ref={wallet}>
          <div className={styles.walletGrid} style={fit}>
            <WalletTotals due={view.due} open={view.open} scale={scale} />

            <div
              className={styles.pocket}
              role="radiogroup"
              aria-label={t("overview.cards.choose")}
            >
              {view.cards.map((card) => (
                <WalletSlot
                  key={card.account.id}
                  card={card}
                  group={group}
                  chosen={card.account.id === view.chosen}
                  scale={scale}
                />
              ))}
              <span className={styles.lip} aria-hidden="true" />
            </div>
          </div>
        </div>
      )}
    </OverviewBlock>
  );
}
