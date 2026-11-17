import { Text } from "@slotted/react/typography";

import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { useCardMoney } from "@/features/cards/card-tile/use-card-money";
import { useT } from "@/i18n/i18n-provider";

interface TicketWeekProps {
  signal: readonly number[] | undefined;
  currency: string;
  scale: number;
}

const minimumHeight = 8;

// The week's purchases, one bar per day; the label carries the meaning and the bars are drawn.
export function TicketWeek({ signal, currency, scale }: TicketWeekProps) {
  const t = useT();
  const money = useCardMoney(currency, scale);

  if (signal === undefined || signal.length <= 1) {
    return null;
  }

  const max = Math.max(...signal, 0);
  const legend = t("accountCard.signal.credit");
  const sum = money.full(signal.reduce((total, value) => total + value, 0));
  const name = t("accountCard.signalName", { legend, amount: sum });

  return (
    <div className={styles.week} role="img" aria-label={name}>
      <span className={styles.weekBars} aria-hidden="true">
        {signal.map((value, i) => (
          <span
            key={i}
            className={styles.weekBar}
            data-last={i === signal.length - 1 || undefined}
            style={{
              blockSize: `${String(Math.max(minimumHeight, max > 0 ? (value * 100) / max : 0))}%`,
            }}
          />
        ))}
      </span>

      <span className={styles.weekText} aria-hidden="true">
        <Text size="xs" tone="muted" wrap="nowrap">
          {legend}
        </Text>
        <Text size="sm" weight="semibold" numeric="tabular" wrap="nowrap">
          {sum}
        </Text>
      </span>
    </div>
  );
}
