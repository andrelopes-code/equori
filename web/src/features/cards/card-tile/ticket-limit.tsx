import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { accountCardMeter } from "@/features/accounts";
import { limitMeter } from "@/features/cards/model/card-totals";
import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { useCardMoney } from "@/features/cards/card-tile/use-card-money";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface TicketLimitProps {
  card: Account["card"];
  currency: string;
  scale: number;
}

// The credit limit in use: its two readings and a segmented bar whose last fifth is the risk zone.
export function TicketLimit({ card, currency, scale }: TicketLimitProps) {
  const t = useT();
  const money = useCardMoney(currency, scale);
  const used = limitMeter(card);
  const meter =
    used === undefined
      ? undefined
      : accountCardMeter("credit", used.used, used.total);

  if (meter === undefined) {
    return null;
  }

  const left = t(meter.leftKey, { amount: money.whole(meter.leftAmount) });
  const right = t(meter.rightKey, { pct: meter.pct });
  const valueText = t("accountCard.meter.text", { right, left });

  return (
    <div className={styles.limit}>
      <div className={styles.limitHead} aria-hidden="true">
        <Text size="sm" weight="semibold" wrap="nowrap">
          {left}
        </Text>
        <Text size="sm" tone="muted" wrap="nowrap">
          {right}
        </Text>
      </div>

      <div
        className={styles.segments}
        role="meter"
        aria-label={t("cards.ticket.limit")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(meter.pct, 100)}
        aria-valuetext={valueText}
        data-state={meter.state}
      >
        <span style={{ inlineSize: `${String(Math.min(meter.pct, 100))}%` }} />
      </div>
    </div>
  );
}
