import { Button } from "@slotted/react/button";
import { StatusIndicator } from "@slotted/react/status-indicator";
import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { StatementLeadResult } from "@/features/cards/card-tile/statement-lead";
import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { TicketEvidence } from "@/features/cards/card-tile/ticket-evidence";
import { TicketLimit } from "@/features/cards/card-tile/ticket-limit";
import { ticketKeys } from "@/features/cards/card-tile/ticket-texts";
import { TicketToggle } from "@/features/cards/card-tile/ticket-toggle";
import { useCardMoney } from "@/features/cards/card-tile/use-card-money";
import { owedAmount } from "@/features/cards/model/card-totals";
import { formatReferenceMonthCompact, formatRelativeDays } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];

interface TicketLeadProps {
  account: Account;
  lead: StatementLeadResult;
  current: Statement | undefined;
  unpaid: Statement[];
  signal: readonly number[] | undefined;
  scale: number;
  today: string;
}

// The statement that asks for action first: its word, the amount, the time left and the limit.
export function TicketLead({
  account,
  lead,
  current,
  unpaid,
  signal,
  scale,
  today,
}: TicketLeadProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { statement, status } = lead;
  const closed = lead.kind === "closed";
  const keys = ticketKeys(lead);
  const currency = closed
    ? statement.unpaid.currency
    : statement.open_amount.currency;
  const money = useCardMoney(currency, scale);
  const amount = closed ? owedAmount(unpaid) : statement.open_amount.amount;
  const reference =
    unpaid.length > 1
      ? t("cards.stub.referenceMany", { count: unpaid.length })
      : t("cards.stub.reference", {
          month: formatReferenceMonthCompact(statement.reference, locale),
        });
  const when = formatRelativeDays(lead.days, locale);
  const whenTone = status === "neutral" ? "muted" : status;

  function handlePay() {
    void navigate({
      to: "/cards/$accountId/statements/$statementId",
      params: { accountId: account.id, statementId: statement.id },
      search: { pay: true },
    });
  }

  function handleToggle() {
    setOpen((value) => !value);
  }

  return (
    <div
      className={styles.ticket}
      role="group"
      aria-label={t(keys.name)}
      data-status={status}
      data-open={open || undefined}
    >
      <div className={styles.head}>
        <StatusIndicator status={status} size="sm">
          {t(keys.word)}
        </StatusIndicator>

        <div className={styles.headEnd}>
          <Text size="xs" tone="muted" truncate>
            {reference}
          </Text>
          <TicketToggle
            open={open}
            title={account.name}
            onClick={handleToggle}
          />
        </div>
      </div>

      <div className={styles.figure}>
        <div className={styles.amount}>
          <Text size="2xl" weight="semibold" numeric="tabular" wrap="nowrap">
            {money.full(amount)}
          </Text>
          {keys.time !== undefined && (
            <Text size="sm" weight="medium" tone={whenTone} wrap="nowrap">
              {t(keys.time, { when })}
            </Text>
          )}
        </div>

        {closed && (
          <Button
            size="sm"
            tone={status === "info" ? "accent" : status}
            onClick={handlePay}
          >
            {t("cards.pay")}
          </Button>
        )}
      </div>

      <TicketEvidence
        lead={lead}
        current={current}
        unpaid={unpaid}
        signal={signal}
        today={today}
        open={open}
        currency={currency}
        scale={scale}
      />

      <TicketLimit
        card={account.card}
        currency={account.currency}
        scale={scale}
      />
    </div>
  );
}
