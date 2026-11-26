import { useId } from "react";
import type { CSSProperties } from "react";

import { DeckCard } from "@/features/overview/cards/deck-card";
import { WalletTotals } from "@/features/overview/cards/wallet-totals";
import styles from "@/features/overview/cards/wallet.module.css";
import { useWallet } from "@/features/overview/cards/use-wallet";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block/overview-block";
import { useT } from "@/i18n/i18n-provider";

// Families read: radio-group, card, carousel, accordion, progress, chart. A radio group draws a
// mark and a label per option; a card is a surface for content; a carousel keeps one item in
// view; an accordion draws a header and a panel per item; a progress bar is a meter of one
// value, not a span of days with two marks; a chart draws axes on its own surface, not marks
// engraved on an object. The deck stacks the faces in depth, brings the chosen one to the front
// and details it (docs/specs/2026-11-26-overview-cards-deck-design.md, CD11). The choice is a
// radio group and the layout answers it through :has(), so the block holds no state. It is a
// form of this widget and of the face, not a Slotted finding.
export function CardsBlock(placement: Placement) {
  const t = useT();
  const group = useId();
  const { view, scale, error, retry } = useWallet();

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
        <div className={styles.deck} data-part="cards">
          <div
            className={styles.deckGrid}
            style={{ "--n": String(view.cards.length) } as CSSProperties}
          >
            <WalletTotals due={view.due} open={view.open} scale={scale} />

            <div
              className={styles.deckGroup}
              role="radiogroup"
              aria-label={t("overview.cards.choose")}
            >
              {view.cards.map((card, place) => (
                <DeckCard
                  key={card.account.id}
                  card={card}
                  group={group}
                  chosen={card.account.id === view.chosen}
                  place={place}
                  scale={scale}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </OverviewBlock>
  );
}
