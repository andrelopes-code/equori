import type { TicketRow } from "@/features/assistant/proposal/ticket/ticket-rows-model";
import { TicketSumRow } from "@/features/assistant/proposal/ticket/ticket-sum-row";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { useT } from "@/i18n/i18n-provider";

interface TicketSumPartProps {
  row: TicketRow;
}

const MINUS = "\u2212";

// One part of the money, or a fact in words; a part that reduces what enters carries a minus.
export function TicketSumPart({ row }: TicketSumPartProps) {
  const t = useT();
  const text = useTicketText();
  const value = text.value(row.value) ?? "";
  const signed = row.minus ? `${MINUS}${value}` : value;

  return (
    <TicketSumRow
      label={t(row.label)}
      text={row.words === undefined ? signed : t(row.words)}
      was={row.was === undefined ? undefined : text.value(row.was)}
    />
  );
}
