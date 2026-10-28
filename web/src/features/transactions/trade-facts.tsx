import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { formatRate } from "@/features/instruments";
import { useScale } from "@/features/setup";
import { AccountFact } from "@/features/transactions/account-fact";
import { decimalText } from "@/features/transactions/decimal-text";
import { FactItem } from "@/features/transactions/fact-item";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";

type Trade = components["schemas"]["Trade"];

export function TradeFacts({ trade }: { trade: Trade }) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data ?? [];
  const scale = useScale();
  if (scale === null) return null;
  const money = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale(m.currency));
  const code = trade.quantity.currency;
  return (
    <>
      <FactItem label={t("transaction.facts.side")}>
        {t(trade.side === "buy" ? "trade.side.buy" : "trade.side.sell")}
      </FactItem>
      <FactItem label={t("transaction.facts.instrument")}>
        <AppLink to={{ to: "/instruments/$code", params: { code } }}>
          {code}
        </AppLink>
      </FactItem>
      <FactItem label={t("transaction.facts.quantity")}>
        {formatRate(decimalText(trade.quantity.amount, scale(code)), tag)}
      </FactItem>
      <FactItem label={t("transaction.facts.unitPrice")}>
        {formatRate(trade.unit_price, tag)}
      </FactItem>
      <FactItem label={t("transaction.facts.gross")}>
        {money(trade.gross)}
      </FactItem>
      <FactItem label={t("transaction.facts.fees")}>
        {money(trade.fees)}
      </FactItem>
      <FactItem label={t("transaction.facts.taxes")}>
        {money(trade.taxes)}
      </FactItem>
      {trade.cost !== undefined && (
        <FactItem label={t("transaction.facts.cost")}>
          {money(trade.cost)}
        </FactItem>
      )}
      <AccountFact
        label={t("transaction.facts.securityAccount")}
        id={trade.account_id}
        accounts={accounts}
      />
      <AccountFact
        label={t("transaction.facts.cashAccount")}
        id={trade.cash_account_id}
        accounts={accounts}
      />
    </>
  );
}
