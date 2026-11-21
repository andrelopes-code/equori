import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { ChargeActions } from "@/features/cards/charge-actions/charge-actions";
import type { ChargeAction } from "@/features/cards/charge-actions/charge-actions";
import { lineAmount } from "@/features/cards/statement-lines/line-amount";
import { LineActionsMenu } from "@/features/cards/statement-lines/line-actions-menu";
import { lineDetail } from "@/features/cards/statement-lines/line-detail";
import { formatDayHeader } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useAmountTone } from "@/ui/money/amount-tone";
import { groupByDay } from "@/ui/statement/group-by-day";
import { StatementDay } from "@/ui/statement/statement-day";
import { StatementItem } from "@/ui/statement/statement-item";
import { StatementList } from "@/ui/statement/statement-list";

type StatementPosting = components["schemas"]["StatementPosting"];

interface StatementLinesListProps {
  lines: readonly StatementPosting[];
  scale: (code: string) => number;
  unconfirmed?: ReadonlySet<string>;
  // The commands of a charge besides opening it (refund, dispute, installment plan).
  onAction: (action: ChargeAction) => void;
}

// Below 600 px a statement's lines read as the statement of /transactions (spec
// 2026-11-21-mobile-statement, MS14): days with their net, each line with its role and installment
// under the description, a line the bank has not reported or a provisional one naming it first.
export function StatementLinesList({
  lines,
  scale,
  unconfirmed,
  onAction,
}: StatementLinesListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  const amountTone = useAmountTone();
  const navigate = useNavigate();

  const words = { today: t("day.today"), yesterday: t("day.yesterday") };
  const days = useMemo(
    () => groupByDay([...lines].sort((a, b) => b.date.localeCompare(a.date))),
    [lines],
  );

  if (lines.length === 0) {
    return (
      <Text size="sm" tone="muted">
        {t("statement.noLines")}
      </Text>
    );
  }

  return (
    <StatementList label={t("statement.lines")}>
      {days.map((day) => {
        const net = day.rows.reduce(
          (sum, line) => sum + lineAmount(line).money.amount,
          0,
        );
        const currency = day.rows[0]?.amount.currency;

        return (
          <StatementDay
            key={day.date}
            endInset
            label={formatDayHeader(day.date, today, locale, words)}
            end={
              currency === undefined
                ? undefined
                : fmt.money({ amount: net, currency }, scale(currency))
            }
          >
            {day.rows.map((line, index) => {
              const { money, direction } = lineAmount(line);
              const detail = lineDetail(
                line,
                unconfirmed?.has(line.transaction_id) === true,
                t,
              );

              return (
                <StatementItem
                  key={`${line.transaction_id}-${String(index)}`}
                  mark={undefined}
                  title={
                    line.description === ""
                      ? t("ledger.untitled")
                      : line.description
                  }
                  struck={false}
                  flag={
                    detail.flag && (
                      <Text size="sm" weight="medium" tone={detail.flag.tone}>
                        {t(detail.flag.key)}
                      </Text>
                    )
                  }
                  detail={detail.text}
                  amount={
                    <Text
                      weight="semibold"
                      numeric="tabular"
                      tone={amountTone("flow", direction)}
                    >
                      {fmt.money(money, scale(money.currency))}
                    </Text>
                  }
                  note={undefined}
                  onOpen={() => {
                    void navigate({
                      to: "/transactions/$id",
                      params: { id: line.transaction_id },
                    });
                  }}
                  selection={undefined}
                  actions={
                    line.card_role === "charge" ? (
                      <LineActionsMenu name={line.description}>
                        <ChargeActions line={line} onAction={onAction} />
                      </LineActionsMenu>
                    ) : undefined
                  }
                />
              );
            })}
          </StatementDay>
        );
      })}
    </StatementList>
  );
}
