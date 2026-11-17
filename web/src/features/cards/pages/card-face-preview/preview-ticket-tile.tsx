import styles from "@/features/cards/card-tile/card-tile.module.css";
import { StatementTicket } from "@/features/cards/card-tile/statement-ticket";
import type { TicketSample } from "@/features/cards/pages/card-face-preview/preview-ticket-data";
import { CardFace } from "@/ui/card-face/card-face";

interface PreviewTicketTileProps {
  sample: TicketSample;
}

// One tile of the card list, composed as CardTile composes it, from fixed data.
export function PreviewTicketTile({ sample }: PreviewTicketTileProps) {
  const { account, face, current, unpaid, signal, loading } = sample;

  return (
    <article className={styles.tile} aria-label={account.name}>
      <div className={styles.face}>
        <CardFace {...face} />
      </div>

      <StatementTicket
        account={account}
        current={current}
        unpaid={unpaid}
        signal={signal}
        scale={2}
        loading={loading}
      />
    </article>
  );
}
