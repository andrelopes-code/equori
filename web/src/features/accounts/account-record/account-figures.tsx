import { useQuery } from "@tanstack/react-query";
import { memo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  balanceQuery,
  goalsQuery,
  projectionQuery,
  reconciliationQuery,
} from "@/features/accounts/api";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { useMoneyFormat } from "@/privacy/use-money-format";
import type { MoneyAmount } from "@/ui/money-value";

type Account = components["schemas"]["Account"];

export const projectionDays = 30;

// RP-02: what the account holds now, where its schedules take it in 30 days, when the ledger last
// agreed with the institution, and the goal it serves.
// Memoised: a tab switch changes the address, and the figures and the chart above the tabs
// do not depend on it, so they skip that render.
export const AccountFigures = memo(function AccountFigures({
  account,
  scale,
}: {
  account: Account;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const today = useToday();
  const leaf = account.class === "asset" || account.class === "liability";
  const booked = useQuery(balanceQuery(api, account.id, today, "booked"));
  const settled = useQuery(balanceQuery(api, account.id, today, "settled"));
  const to = shiftDate(today, projectionDays);
  const projection = useQuery({
    ...projectionQuery(api, account.id, to),
    enabled: leaf && account.closed_on === undefined,
  });
  const reconciliation = useQuery({
    ...reconciliationQuery(api, account.id),
    enabled: leaf,
  });
  const goals = useQuery(goalsQuery(api));
  const goal = goals.data?.find((g) => g.account_ids.includes(account.id));
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
  const figure = (m: components["schemas"]["Money"]): MoneyAmount => ({
    money: m,
    scale: scale(m.currency),
  });
  const last = reconciliation.data?.last_reconciled_on;
  const open = reconciliation.data?.open_difference;

  return (
    <FigureGrid label={t("account.figures")}>
      <FigureCard
        label={t("account.figure.balance")}
        value={
          booked.data === undefined ? undefined : figure(booked.data.balance)
        }
        note={
          settled.data === undefined
            ? t("account.figure.balanceNote")
            : t("account.figure.settled", {
                amount: money(settled.data.balance),
              })
        }
        loading={booked.isPending}
      />
      {account.closed_on === undefined && (
        <FigureCard
          label={t("account.figure.projection", { days: projectionDays })}
          value={
            projection.data === undefined
              ? undefined
              : figure(projection.data.closing)
          }
          note={
            projection.data === undefined
              ? t("account.figure.projectionNone")
              : t("account.figure.projectionNote", {
                  count: projection.data.points.length,
                  date: formatDate(to, locale),
                })
          }
          loading={projection.isPending && projection.fetchStatus !== "idle"}
        />
      )}
      <FigureCard
        label={t("account.figure.reconciled")}
        value={
          reconciliation.data === undefined
            ? undefined
            : last === undefined
              ? t("account.figure.never")
              : formatDate(last, locale)
        }
        note={
          open === undefined
            ? last === undefined
              ? t("account.figure.neverNote")
              : t("account.figure.reconciledNote")
            : t("account.figure.openDifference", {
                amount: money(open.difference),
                date: formatDate(open.date, locale),
              })
        }
        loading={
          reconciliation.isPending && reconciliation.fetchStatus !== "idle"
        }
      />
      {goal !== undefined && (
        <FigureCard
          label={goal.name}
          value={t("account.figure.goalProgress", {
            percent: Math.floor(goal.progress_bp / 100),
          })}
          note={t("account.figure.goalNote", {
            remaining: money(goal.remaining),
            date: formatDate(goal.due_on, locale),
          })}
        />
      )}
    </FigureGrid>
  );
});
