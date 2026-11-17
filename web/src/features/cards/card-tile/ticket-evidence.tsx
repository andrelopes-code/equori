import { ProgressBar } from "@slotted/react/progress-indicator";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { paidShare } from "@/features/cards/card-tile/statement-due";
import type { StatementLeadResult } from "@/features/cards/card-tile/statement-lead";
import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { TicketCycle } from "@/features/cards/card-tile/ticket-cycle";
import { TicketWeek } from "@/features/cards/card-tile/ticket-week";
import { useCardMoney } from "@/features/cards/card-tile/use-card-money";
import { formatDayMonth, formatReferenceMonthCompact } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Statement = components["schemas"]["StatementSummary"];

interface TicketEvidenceProps {
  lead: StatementLeadResult;
  current: Statement | undefined;
  unpaid: Statement[];
  signal: readonly number[] | undefined;
  today: string;
  open: boolean;
  currency: string;
  scale: number;
}

// What backs the figure: the dates, the paid share, the cycle, the other statement and the week.
// The block is always in the document; it is inert and collapsed until the ticket is open.
export function TicketEvidence({
  lead,
  current,
  unpaid,
  signal,
  today,
  open,
  currency,
  scale,
}: TicketEvidenceProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const money = useCardMoney(currency, scale);
  const share = paidShare(unpaid);
  const { statement } = lead;
  const closed = lead.kind === "closed";
  const paidText = t("cards.stub.paid", {
    paid: money.full(share.paid),
    total: money.full(share.total),
  });

  return (
    <div className={styles.more} data-open={open || undefined}>
      <div className={styles.evidence} inert={!open}>
        {share.paid > 0 && (
          <ProgressBar
            size="sm"
            tone="success"
            value={share.paid}
            max={share.total}
            label={paidText}
            valueText={paidText}
          />
        )}

        <TicketCycle
          closing={statement.closing_date}
          due={statement.due_date}
          today={today}
          status={lead.status}
        />

        {closed && current !== undefined && (
          <>
            <div className={styles.perforation} aria-hidden="true" />

            <div className={styles.other}>
              <Text size="sm" tone="muted" truncate>
                {t("cards.ticket.otherOpen", {
                  month: formatReferenceMonthCompact(current.reference, locale),
                })}
              </Text>
              <Text size="sm" wrap="nowrap">
                <b>{money.full(current.open_amount.amount)}</b>{" "}
                {t("cards.ticket.otherCloses", {
                  date: formatDayMonth(current.closing_date, locale),
                })}
              </Text>
            </div>
          </>
        )}

        <TicketWeek signal={signal} currency={currency} scale={scale} />
      </div>
    </div>
  );
}
