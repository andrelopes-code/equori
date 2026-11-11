import { memo } from "react";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { useMoneyFormat } from "@/privacy/use-money-format";
import type { MoneyAmount } from "@/ui/money-value";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Statement = components["schemas"]["StatementSummary"];

// RP-02: the statement purchases go on now, the next one to pay, the free limit and the
// installments already committed to the coming statements.
export const CardFigures = memo(function CardFigures({
  account,
  current,
  unpaid,
  committed,
  loading,
  scale,
}: {
  account: Account;
  current: Statement | undefined;
  unpaid: Statement[];
  committed: Money | undefined;
  loading: boolean;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const figure = (m: Money): MoneyAmount => ({
    money: m,
    scale: scale(m.currency),
  });
  const oldest = unpaid[0];
  const owed = unpaid.reduce((sum, s) => sum + s.unpaid.amount, 0);
  const overdue = unpaid.find((s) => s.status === "overdue");
  const limit = account.card?.credit_limit;
  const available = account.card?.available_limit;
  const overLimit = available !== undefined && available.amount < 0;
  const limitNote =
    limit === undefined
      ? t("cards.limitNone")
      : t("cards.limitOf", { limit: money(limit) });
  const availableNote = overLimit
    ? t("accountCard.meter.credit.over", {
        amount: money({ ...available, amount: -available.amount }),
      })
    : limitNote;
  return (
    <FigureGrid label={t("card.figures")}>
      <FigureCard
        label={t("card.figure.current")}
        value={current === undefined ? undefined : figure(current.open_amount)}
        note={
          current === undefined
            ? t("cards.noStatement")
            : t("card.closesOn", {
                date: formatDate(current.closing_date, locale),
              })
        }
        loading={loading}
      />
      <FigureCard
        label={t("card.figure.next")}
        value={
          oldest === undefined
            ? loading
              ? undefined
              : t("card.nothing")
            : figure({ amount: owed, currency: oldest.unpaid.currency })
        }
        note={owedNoteOf(unpaid, t, locale)}
        attention={overdue === undefined ? undefined : "danger"}
        loading={loading}
      />
      <FigureCard
        label={t("cards.figure.available")}
        value={available === undefined ? undefined : figure(available)}
        note={availableNote}
        attention={overLimit ? "danger" : undefined}
      />
      <FigureCard
        label={t("card.figure.committed")}
        value={committed === undefined ? undefined : figure(committed)}
        note={t("card.committedNote")}
        loading={committed === undefined && loading}
      />
    </FigureGrid>
  );
});

// What the closed statements owe: the date the oldest one is overdue since, or the date it was
// due.
function owedNoteOf(
  unpaid: readonly Statement[],
  t: TFunction,
  locale: string,
): string {
  const oldest = unpaid[0];
  const overdue = unpaid.find((s) => s.status === "overdue");

  if (oldest === undefined) return t("cards.nothingDue");

  return t(overdue === undefined ? "card.owedNote" : "card.overdueNote", {
    count: unpaid.length,
    date: formatDate((overdue ?? oldest).due_date, locale),
  });
}
