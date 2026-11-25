import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import type { TicketNet } from "@/features/assistant/proposal/ticket/ticket-model";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface TicketSumNetProps {
  net: TicketNet;
}

// What the account pays or receives.
export function TicketSumNet({ net }: TicketSumNetProps) {
  const t = useT();
  const text = useTicketText();
  const direction = net.leaves ? "out" : "in";
  const label =
    net.account === undefined
      ? t(`assistant.ticket.${direction}.unnamed`)
      : t(`assistant.ticket.${direction}`, { account: net.account });

  return (
    <div className={styles.netRow} data-part="net">
      <dt className={cx(styles.netLabel, styles.oneLine)} title={label}>
        {label}
      </dt>
      <dd className={cx(styles.num, styles.net)}>{text.value(net.value)}</dd>
    </div>
  );
}
