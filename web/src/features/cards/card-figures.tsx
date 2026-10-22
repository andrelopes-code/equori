import { memo } from "react";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { useMoneyFormat } from "@/privacy/use-money-format";

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
  const oldest = unpaid[0];
  const owed = unpaid.reduce((sum, s) => sum + s.unpaid.amount, 0);
  const limit = account.card?.credit_limit;
  const available = account.card?.available_limit;
  return (
    <FigureGrid label={t("card.figures")}>
      <FigureCard
        label={t("card.figure.current")}
        value={current === undefined ? undefined : money(current.amount_due)}
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
            : money({ amount: owed, currency: oldest.unpaid.currency })
        }
        note={
          oldest === undefined
            ? t("cards.nothingDue")
            : t("card.owedNote", {
                count: unpaid.length,
                date: formatDate(oldest.due_date, locale),
              })
        }
        loading={loading}
      />
      <FigureCard
        label={t("cards.figure.available")}
        value={available === undefined ? undefined : money(available)}
        note={
          limit === undefined
            ? t("cards.limitNone")
            : t("cards.limitOf", { limit: money(limit) })
        }
      />
      <FigureCard
        label={t("card.figure.committed")}
        value={committed === undefined ? undefined : money(committed)}
        note={t("card.committedNote")}
        loading={committed === undefined && loading}
      />
    </FigureGrid>
  );
});
