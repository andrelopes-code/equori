import { Button } from "@slotted/react/button";
import { ProgressBar } from "@slotted/react/progress-indicator";
import { StatusIndicator } from "@slotted/react/status-indicator";
import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { owedAmount } from "@/features/cards/card-totals";
import { paidShare, statementDue } from "@/features/cards/statement-due";
import styles from "@/features/cards/statement-stub.module.css";
import {
  formatDayMonth,
  formatReferenceMonth,
  formatRelativeDays,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];

interface StatementStubProps {
  accountId: string;
  // The closed statements still owing, oldest first.
  unpaid: Statement[];
  scale: number;
}

// Families read: card, alert, stat-card. A card is a surface beside others and an alert a notice
// over a region; this stub is the closed statement drawn as a slip tucked under the physical
// account card, tinted by how near its due date is. It is a deliberate element of equori's
// visual identity, not a Slotted finding. StatusIndicator, Text, ProgressBar and Button draw
// every part of it; the stub owns only the slip.
export function StatementStub({
  accountId,
  unpaid,
  scale,
}: StatementStubProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const navigate = useNavigate();
  const today = useToday();

  const oldest = unpaid[0];

  if (oldest === undefined) {
    return null;
  }

  const statementId = oldest.id;
  const currency = oldest.unpaid.currency;
  const money = (amount: number) => fmt.money({ amount, currency }, scale);
  const due = statementDue(oldest.due_date, today);
  const when = formatRelativeDays(due.days, locale);
  const share = paidShare(unpaid);
  const single = unpaid.length === 1;
  const reference = single
    ? t("cards.stub.reference", {
        month: formatReferenceMonth(oldest.reference, locale),
      })
    : t("cards.stub.referenceMany", { count: unpaid.length });
  const paidText = t("cards.stub.paid", {
    paid: money(share.paid),
    total: money(share.total),
  });

  function handlePay() {
    void navigate({
      to: "/cards/$accountId/statements/$statementId",
      params: { accountId, statementId },
      search: { pay: true },
    });
  }

  return (
    <div
      className={styles.stub}
      data-status={due.status}
      role="group"
      aria-label={t("cards.stub.name")}
    >
      <div className={styles.head}>
        <StatusIndicator status={due.status} size="sm">
          {t(due.days < 0 ? "cards.stub.overdue" : "cards.stub.due", { when })}
        </StatusIndicator>
        <Text size="xs" tone="muted" truncate>
          {reference}
        </Text>
      </div>

      <div className={styles.body}>
        <div className={styles.figure}>
          <Text size="2xl" weight="semibold" numeric="tabular" wrap="nowrap">
            {money(owedAmount(unpaid))}
          </Text>
          {single && (
            <Text size="xs" tone="muted">
              {t("cards.stub.dates", {
                closing: formatDayMonth(oldest.closing_date, locale),
                due: formatDayMonth(oldest.due_date, locale),
              })}
            </Text>
          )}
        </div>
        <Button size="sm" onClick={handlePay}>
          {t("cards.pay")}
        </Button>
      </div>

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
    </div>
  );
}
