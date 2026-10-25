import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { catalogLabel, useScale } from "@/features/setup";
import { AccountFact } from "@/features/transactions/account-fact";
import { FactItem } from "@/features/transactions/fact-item";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type InvestmentIncome = components["schemas"]["InvestmentIncome"];

export function IncomeFacts({ income }: { income: InvestmentIncome }) {
  const t = useT();
  const fmt = useMoneyFormat();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data ?? [];
  const scale = useScale();
  if (scale === null) return null;
  const money = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale(m.currency));
  const net = {
    amount: income.gross.amount - income.withheld.amount,
    currency: income.gross.currency,
  };
  return (
    <>
      <FactItem label={t("transaction.facts.incomeType")}>
        {catalogLabel(
          t,
          `income.type.${income.income_type}`,
          income.income_type,
        )}
      </FactItem>
      <FactItem label={t("transaction.facts.gross")}>
        {money(income.gross)}
      </FactItem>
      <FactItem label={t("transaction.facts.withheld")}>
        {money(income.withheld)}
      </FactItem>
      <FactItem label={t("transaction.facts.net")}>{money(net)}</FactItem>
      <AccountFact
        label={t("transaction.facts.securityAccount")}
        id={income.account_id}
        accounts={accounts}
      />
      <AccountFact
        label={t("transaction.facts.cashAccount")}
        id={income.cash_account_id}
        accounts={accounts}
      />
    </>
  );
}
