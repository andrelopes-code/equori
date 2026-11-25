import { useState } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import { TicketOrder } from "@/features/assistant/proposal/ticket/ticket-order";
import { useT } from "@/i18n/i18n-provider";

type Item = components["schemas"]["AssistantPreviewItem"];

interface TicketOrdersProps {
  orders: readonly Item[];
}

const SHOWN = 5;

// The orders of a note: five, and a button that shows the rest.
export function TicketOrders({ orders }: TicketOrdersProps) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = all ? orders : orders.slice(0, SHOWN);
  const left = orders.length - shown.length;

  return (
    <div className={styles.orderList}>
      <ul className={styles.orders}>
        {shown.map((order, i) => (
          <TicketOrder
            key={`${order.description}-${String(i)}`}
            order={order}
          />
        ))}
      </ul>

      {left > 0 && (
        <button
          type="button"
          className={styles.more}
          onClick={() => {
            setAll(true);
          }}
        >
          {left === 1
            ? t("assistant.ticket.more.one")
            : t("assistant.ticket.more.many", { count: left })}
        </button>
      )}
    </div>
  );
}
