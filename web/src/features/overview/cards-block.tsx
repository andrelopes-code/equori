import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { currentAndUnpaid, statementsQuery } from "@/features/cards";
import { owedStatements } from "@/features/overview/open-statements";
import { OverviewBlock } from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useBase } from "@/features/overview/use-base";
import { shiftMonth } from "@/features/overview/forecast";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyFigure } from "@/ui/money-figure";

// Twelve months back hold every closed statement still owing in practice.
const lookBackMonths = 12;

export function CardsBlock({ onHide }: { onHide?: (() => void) | undefined }) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const from = shiftMonth(useToday().slice(0, 7), -lookBackMonths);
  const accounts = useQuery(accountsQuery(api));
  const cards = (accounts.data ?? []).filter(
    (account) =>
      account.kind === "credit_card" && account.closed_on === undefined,
  );
  const statements = useQueries({
    queries: cards.map((card) => statementsQuery(api, card.id, from)),
  });
  const error =
    accounts.error ??
    statements.find((query) => query.error !== null)?.error ??
    null;
  const loading =
    accounts.data === undefined ||
    scale === null ||
    statements.some((query) => query.data === undefined);
  const rows =
    loading || error !== null
      ? []
      : owedStatements(
          cards.map((account, i) => ({
            account,
            ...currentAndUnpaid(statements[i]?.data ?? []),
          })),
        ).map((owed) => ({
          key: owed.statement.id,
          title: owed.account.name,
          line: t(owed.open ? "overview.cards.dueOpen" : "overview.cards.due", {
            date: formatDate(owed.statement.due_date, locale),
          }),
          end: (
            <MoneyFigure
              amount={owed.amount.amount}
              currency={owed.amount.currency}
              scale={scale(owed.amount.currency)}
            />
          ),
          to: {
            to: "/cards/$accountId/statements/$statementId" as const,
            params: {
              accountId: owed.account.id,
              statementId: owed.statement.id,
            },
          },
        }));
  return (
    <OverviewBlock
      onHide={onHide}
      title={t("overview.cards.title")}
      link={{ label: t("overview.cards.open"), options: { to: "/cards" } }}
      loading={loading && error === null}
      error={error}
      onRetry={() => {
        if (accounts.isError) void accounts.refetch();
        for (const query of statements) {
          if (query.isError) void query.refetch();
        }
      }}
      empty={rows.length === 0 ? t("overview.cards.empty") : undefined}
    >
      <OverviewRows label={t("overview.cards.title")} rows={rows} />
    </OverviewBlock>
  );
}
