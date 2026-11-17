import type { components } from "@/api/schema.gen";
import { statementLead } from "@/features/cards/card-tile/statement-lead";
import { TicketEmpty } from "@/features/cards/card-tile/ticket-empty";
import { TicketLead } from "@/features/cards/card-tile/ticket-lead";
import { TicketSkeleton } from "@/features/cards/card-tile/ticket-skeleton";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];

interface StatementTicketProps {
  account: Account;
  current: Statement | undefined;
  // The closed statements still owing, oldest first.
  unpaid: Statement[];
  signal: readonly number[] | undefined;
  scale: number;
  loading: boolean;
}

// Families read: card, alert, stat-card, status-indicator. A card is a surface beside others and
// an alert a notice over a region; this ticket is the statement drawn as a slip tucked under the
// card face, with a perforation and a cycle track that no family draws. It is a deliberate
// element of equori's visual identity, not a Slotted finding. StatusIndicator, Text, ProgressBar
// and Button draw every text of it; the ticket owns only the slip, the track and the segments.
export function StatementTicket({
  account,
  current,
  unpaid,
  signal,
  scale,
  loading,
}: StatementTicketProps) {
  const today = useToday();
  const lead = statementLead(current, unpaid, today);

  if (loading) {
    return <TicketSkeleton />;
  }

  if (lead === undefined) {
    return <TicketEmpty account={account} scale={scale} />;
  }

  return (
    <TicketLead
      account={account}
      lead={lead}
      current={current}
      unpaid={unpaid}
      signal={signal}
      scale={scale}
      today={today}
    />
  );
}
