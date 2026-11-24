import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery, balanceQuery } from "@/features/accounts";
import { settingsQuery, useScale } from "@/features/setup";
import {
  incomeTypesQuery,
  useCorrectInvestmentIncome,
  useRecordInvestmentIncome,
} from "@/features/transactions/api";
import { balanceWithout } from "@/features/transactions/correction/without-original";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import {
  emptyIncome,
  incomePreset,
  isIncomeDraft,
} from "@/features/transactions/income-entry/income-draft";
import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import { useIncomeEstimate } from "@/features/transactions/income-entry/use-income-estimate";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import type { NewTransactionSearch } from "@/features/transactions/model/search";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Transaction = components["schemas"]["Transaction"];

const draftKey = "new-income";

// A227: the stored income a correction replaces, the form it opens on and the reason typed.
export interface IncomeCorrection {
  transaction: Transaction;
  start: IncomeDraft;
  reason: string;
}

// The state of the investment income form. The server stores the amounts; the net amount here is
// gross minus withheld, a preview. Withheld is always sent, so what the form shows is what is
// recorded: the default a jurisdiction sets for a type is an estimate the reader may use. A correction keeps
// no draft in the browser and reads the balance without the income it replaces (A227 IC10).
export function useIncomeEntry(
  accountId: string | null,
  correction?: IncomeCorrection,
  presets: NewTransactionSearch = {},
) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const record = useRecordInvestmentIncome();
  const correct = useCorrectInvestmentIncome();
  const types = useQuery(incomeTypesQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const [draft, setDraft] = useState<IncomeDraft>(() => {
    if (correction !== undefined) return correction.start;
    const stored = readStored(draftKey);
    const start = isIncomeDraft(stored) ? stored : emptyIncome(today);
    return { ...start, ...incomePreset(accountId, presets) };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const correcting = correction !== undefined;
  useEffect(() => {
    if (!correcting) writeDraft(draftKey, draft);
  }, [draft, correcting]);

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
  const payer =
    state.payers.find((a) => a.id === draft.cashAccountId) ?? state.payer;
  const balance = balanceWithout(
    useQuery({
      ...balanceQuery(api, payer?.id ?? "", draft.date, "booked"),
      enabled: payer !== undefined,
    }).data?.balance.amount,
    correction?.transaction,
    payer?.id,
    draft.date,
  );
  const estimate = useIncomeEstimate(draft.incomeType, draft.date, draft.gross);
  const withheldTooHigh = draft.withheld > 0 && draft.withheld >= draft.gross;
  const net =
    draft.gross > 0 && !withheldTooHigh ? draft.gross - draft.withheld : null;
  const view = {
    brokerages: state.brokerages,
    brokerage,
    instrument,
    heldCodes: state.holdings.map((a) => a.currency),
    payers: state.payers,
    payer,
    baseCash: state.baseCash,
    balance,
    base,
    types: types.data ?? [],
    net,
    estimate,
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
    if (payer === undefined)
      problems.cash_account_id = t("trade.required.cashAccount");
    if (draft.incomeType === null)
      problems.income_type = t("income.required.type");
    if (draft.gross <= 0) problems.gross = t("entry.required.amount");
    if (withheldTooHigh) problems.withheld = t("income.withheldTooHigh");
    if (draft.categoryId === null)
      problems.category_id = t("entry.required.category");
    if (correction?.reason.trim() === "")
      problems.reason = t("correct.reasonRequired");
    if (
      Object.keys(problems).length > 0 ||
      brokerage === undefined ||
      instrument === null ||
      payer === undefined ||
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
    const order: components["schemas"]["InvestmentIncomeInput"] = {
      brokerage_id: brokerage.id,
      instrument,
      cash_account_id: payer.id,
      income_type: draft.incomeType,
      date: draft.date,
      gross: { amount: draft.gross, currency: base },
      withheld: { amount: draft.withheld, currency: base },
      category_id: draft.categoryId,
      ...(draft.withheld > 0 && draft.withheldCategoryId !== null
        ? { withheld_category_id: draft.withheldCategoryId }
        : {}),
      ...(description === "" ? {} : { description }),
    };
    try {
      if (correction !== undefined) {
        return await correct.mutateAsync({
          current: correction.transaction,
          body: {
            expected_version: correction.transaction.version,
            reason: correction.reason.trim(),
            income: order,
          },
        });
      }
      const created = await record.mutateAsync(order);
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
    pending: record.isPending || correct.isPending,
    discard: () => {
      clearDraft(draftKey);
    },
  };
}
