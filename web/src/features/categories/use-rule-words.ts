import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import type { RuleWords } from "@/features/categories/rule-sentence";
import { useCategoryEntries } from "@/features/categories/use-category-entries";
import { payeesQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The words a rule is read in: payees, accounts and category paths by id, money by its scale.
export function useRuleWords(): RuleWords {
  const t = useT();
  const fmt = useMoneyFormat();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const scale = useScale();
  return useMemo(() => {
    const names = new Map<string, string>([
      ...(accounts.data ?? []).map((a): [string, string] => [a.id, a.name]),
      ...entries.map((e): [string, string] => [e.id, e.path]),
      ...(payees.data ?? []).map((p): [string, string] => [p.id, p.name]),
    ]);
    return {
      t,
      name: (id) =>
        id === "" ? t("rule.unset") : (names.get(id) ?? t("rule.unknown")),
      money: (m) => fmt.money(m, scale?.(m.currency) ?? 2),
    };
  }, [accounts.data, entries, payees.data, scale, t, fmt]);
}
