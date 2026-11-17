import type { CSSProperties } from "react";

import styles from "@/features/cards/card-tile/card-tile.module.css";
import { TicketSkeleton } from "@/features/cards/card-tile/ticket-skeleton";
import { CardFaceSkeleton } from "@/ui/card-face/card-face-skeleton";

interface CardTilePlaceholderProps {
  index: number;
}

// The tile of a card not known yet: the face and the closed ticket, in the boxes of card-tile.tsx.
export function CardTilePlaceholder({ index }: CardTilePlaceholderProps) {
  return (
    <div className={styles.tile} style={{ "--i": index } as CSSProperties}>
      <div className={styles.face}>
        <CardFaceSkeleton />
      </div>

      <div className={styles.ticket}>
        <TicketSkeleton />
      </div>
    </div>
  );
}
