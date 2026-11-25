import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import { priced } from "@/features/assistant/proposal/ticket/ticket-money";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Item = components["schemas"]["AssistantPreviewItem"];

interface TicketOrderProps {
  order: Item;
}

// One order of a note: the units and the security over the side and the price, the gross at the
// end. An order that settles on its own date names it.
export function TicketOrder({ order }: TicketOrderProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const text = useTicketText();
  const price = text.value(priced(order.price, order.amount)) ?? "";
  const side =
    order.side === "sell"
      ? t("assistant.ticket.order.sell", { price })
      : t("assistant.ticket.order.buy", { price });
  const settles =
    order.date === undefined
      ? []
      : [
          t("assistant.ticket.order.settles", {
            date: formatDayMonthNumeric(order.date, locale),
          }),
        ];

  return (
    <li className={styles.order} data-part="order">
      <span className={styles.orderWhat}>
        <span className={cx(styles.orderName, styles.oneLine)}>
          {text.quantity(order.quantity ?? {})} {order.description}
        </span>
        <span className={cx(styles.muted, styles.oneLine)}>
          {[side, ...settles].join(" · ")}
        </span>
      </span>

      <span className={styles.num}>{text.value(order.amount)}</span>
    </li>
  );
}
