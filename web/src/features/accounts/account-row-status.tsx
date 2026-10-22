import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { reconciliationQuery } from "@/features/accounts/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

// Whether the ledger agrees with the institution: the last date it did, or the difference that
// waits. A card agrees statement by statement and a parent through its sub-accounts, so neither
// carries the mark.
export function AccountRowStatus({
  account,
  scale,
}: {
  account: Account;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const status = useQuery({
    ...reconciliationQuery(useApi(), account.id),
    enabled: account.kind !== "credit_card",
  });
  if (status.data === undefined) return null;
  const open = status.data.open_difference;
  if (open !== undefined) {
    return (
      <Tag size="sm" tone="warning">
        {t("reconciliation.tag.open", {
          amount: fmt.money(open.difference, scale(open.difference.currency)),
        })}
      </Tag>
    );
  }
  const last = status.data.last_reconciled_on;
  return last === undefined ? (
    <Tag size="sm" tone="secondary">
      {t("reconciliation.tag.never")}
    </Tag>
  ) : (
    <Tag size="sm" tone="success">
      {t("reconciliation.tag.on", { date: formatDate(last, locale) })}
    </Tag>
  );
}
