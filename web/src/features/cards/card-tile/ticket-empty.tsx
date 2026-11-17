import { StatusIndicator } from "@slotted/react/status-indicator";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { TicketLimit } from "@/features/cards/card-tile/ticket-limit";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface TicketEmptyProps {
  account: Account;
  scale: number;
}

// A card with no statement yet: the limit is all the ticket has to say.
export function TicketEmpty({ account, scale }: TicketEmptyProps) {
  const t = useT();

  return (
    <div
      className={styles.ticket}
      role="group"
      aria-label={t("cards.ticket.openName")}
      data-status="neutral"
    >
      <div className={styles.head}>
        <StatusIndicator status="neutral" size="sm">
          {t("cards.ticket.word.none")}
        </StatusIndicator>
      </div>

      <div className={styles.emptyText}>
        <Text size="sm" tone="muted">
          {t("cards.ticket.empty")}
        </Text>
      </div>

      <TicketLimit
        card={account.card}
        currency={account.currency}
        scale={scale}
      />
    </div>
  );
}
