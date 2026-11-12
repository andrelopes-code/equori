import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery, balanceQuery } from "@/features/accounts";
import { settingsQuery, useScale } from "@/features/setup";
import {
  incomeTypesQuery,
  useRecordInvestmentIncome,
} from "@/features/transactions/api";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import {
  emptyIncome,
  isIncomeDraft,
} from "@/features/transactions/income-entry/income-draft";
import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

const draftKey = "new-income";

// The state of the investment income form. The server stores the amounts; the net amount here is
// gross minus withheld, a preview. Withheld is always sent, so what the form shows is what is
// recorded: the default a jurisdiction sets for a type is not assumed here.
export function useIncomeEntry(accountId: string | null) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const record = useRecordInvestmentIncome();
  const types = useQuery(incomeTypesQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const [draft, setDraft] = useState<IncomeDraft>(() => {
    const stored = readStored(draftKey);
    const start = isIncomeDraft(stored) ? stored : emptyIncome(today);
    return start;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  // A route that names a holding account stands for its brokerage and its investment.
  const holding = useQuery(accountsQuery(api)).data?.find(
    (a) => a.id === accountId,
  );
  const preset =
    holding?.parent_id === undefined
      ? null
      : { brokerageId: holding.parent_id, instrument: holding.currency };
  const chosen =
    draft.brokerageId === null && draft.instrument === null && preset !== null
      ? preset
      : draft;
  const state = useBrokerages(chosen.brokerageId, chosen.instrument);
  const { brokerage } = state;
  const instrument = chosen.instrument;
  const cashAccount =
    state.cash.find((a) => a.id === draft.cashAccountId) ?? state.cashAccount;
  const balance = useQuery({
    ...balanceQuery(api, cashAccount?.id ?? "", draft.date, "booked"),
    enabled: cashAccount !== undefined,
  }).data?.balance.amount;
  const withheldTooHigh = draft.withheld > 0 && draft.withheld >= draft.gross;
  const net =
    draft.gross > 0 && !withheldTooHigh ? draft.gross - draft.withheld : null;
  const view = {
    brokerages: state.brokerages,
    brokerage,
    instrument,
    heldCodes: state.holdings.map((a) => a.currency),
    cash: state.cash,
    cashAccount,
    baseCash: state.baseCash,
    balance,
    base,
    types: types.data ?? [],
    net,
    ready: base !== undefined && scale !== null && types.data !== undefined,
  };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const problems: Record<string, string> = {};
    if (brokerage === undefined)
      problems.brokerage_id = t("entry.required.account");
    if (instrument === null)
      problems.instrument = t("trade.required.securityAccount");
    if (cashAccount === undefined)
      problems.cash_account_id = t("trade.required.cashAccount");
    if (draft.incomeType === null)
      problems.income_type = t("income.required.type");
    if (draft.gross <= 0) problems.gross = t("entry.required.amount");
    if (withheldTooHigh) problems.withheld = t("income.withheldTooHigh");
    if (draft.categoryId === null)
      problems.category_id = t("entry.required.category");
    if (
      Object.keys(problems).length > 0 ||
      brokerage === undefined ||
      instrument === null ||
      cashAccount === undefined ||
      draft.incomeType === null ||
      draft.categoryId === null ||
      base === undefined
    ) {
      setErrors(problems);
      setSummary(t("entry.fixFields"));
      return null;
    }
    setErrors({});
    setSummary(null);
    const description = draft.description.trim();
    try {
      const created = await record.mutateAsync({
        brokerage_id: brokerage.id,
        instrument,
        cash_account_id: cashAccount.id,
        income_type: draft.incomeType,
        date: draft.date,
        gross: { amount: draft.gross, currency: base },
        withheld: { amount: draft.withheld, currency: base },
        category_id: draft.categoryId,
        ...(draft.withheld > 0 && draft.withheldCategoryId !== null
          ? { withheld_category_id: draft.withheldCategoryId }
          : {}),
        ...(description === "" ? {} : { description }),
      });
      clearDraft(draftKey);
      return created;
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
      return null;
    }
  };

  const reset = () => {
    // The next income keeps the brokerage, the investment, the type and the date.
    setDraft({
      ...emptyIncome(draft.date, brokerage?.id ?? null),
      instrument,
      cashAccountId: draft.cashAccountId,
      incomeType: draft.incomeType,
      categoryId: draft.categoryId,
    });
  };

  return {
    draft,
    setDraft,
    errors,
    summary,
    view,
    submit,
    reset,
    pending: record.isPending,
    discard: () => {
      clearDraft(draftKey);
    },
  };
}
