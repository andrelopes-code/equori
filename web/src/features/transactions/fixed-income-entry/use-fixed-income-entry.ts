import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { balanceQuery } from "@/features/accounts";
import { indexesQuery } from "@/features/calculators";
import { subtypesQuery } from "@/features/instruments";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { useRecordFixedIncomeApplication } from "@/features/transactions/api";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import {
  applicationBody,
  emptyFixedIncomeDraft,
} from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import type { FixedIncomeDraft } from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { newId } from "@/ui/runtime/new-id";

interface Index {
  id: string;
  period: string;
}

export interface FixedIncomeView {
  base: string | undefined;
  brokerages: components["schemas"]["Account"][];
  brokerage: components["schemas"]["Account"] | undefined;
  payers: components["schemas"]["Account"][];
  payer: components["schemas"]["Account"] | undefined;
  baseCash: boolean;
  // Minor units of the base currency; undefined until the balance loads.
  balance: number | undefined;
  subtypes: string[];
  // The contracts of the book that accept another application.
  contracts: components["schemas"]["Instrument"][];
  issuers: string[];
  // The indexes of the chosen return kind and the one the body names.
  indexes: Index[];
  indexId: string;
  ready: boolean;
}

// The state of the fixed income form: the draft and what the server's reads add to it. The server
// stays the source of the contract rules; the form checks only what it cannot send without.
export function useFixedIncomeEntry(
  brokerageId: string | null,
  contract: string | null,
) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const record = useRecordFixedIncomeApplication();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const instruments = useQuery(instrumentsQuery(api)).data?.items;
  const indexes = useQuery(indexesQuery(api)).data;
  const subtypes = useQuery(subtypesQuery(api, "fixed_income")).data;

  const [draft, setDraft] = useState<FixedIncomeDraft>(() => ({
    ...emptyFixedIncomeDraft(newId(), brokerageId, today),
    instrument: contract,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const state = useBrokerages(draft.brokerageId, draft.cashAccountId);
  const payer = state.payer;
  const balanceRead = useQuery({
    ...balanceQuery(api, payer?.id ?? "", draft.appliedOn, "booked"),
    enabled: payer !== undefined,
  });
  const owned = (instruments ?? []).filter(
    (i) => i.type === "fixed_income" && i.owned,
  );
  const period = draft.returnKind === "inflation" ? "month" : "day";
  const matching = (indexes ?? []).filter((i) => i.period === period);
  const indexId = matching.some((i) => i.id === draft.indexId)
    ? draft.indexId
    : (matching[0]?.id ?? "");

  const view: FixedIncomeView = {
    base,
    brokerages: state.brokerages,
    brokerage: state.brokerage,
    payers: state.payers,
    payer,
    baseCash: state.baseCash,
    balance: balanceRead.data?.balance.amount,
    subtypes: subtypes ?? [],
    contracts: owned,
    issuers: [...new Set(owned.flatMap((i) => i.issuer?.name ?? []))],
    indexes: matching,
    indexId,
    ready: base !== undefined && instruments !== undefined,
  };

  const submit = async (): Promise<{ id: string } | null> => {
    const brokerage = state.brokerage;
    const result = applicationBody(
      {
        ...draft,
        brokerageId: brokerage?.id ?? null,
        cashAccountId: payer?.id ?? null,
        currency: brokerage?.currency ?? base ?? "",
        indexId,
      },
      t,
    );
    const problems: Record<string, string> =
      "errors" in result ? { ...result.errors } : {};
    if (brokerage === undefined)
      problems.brokerage_id = t("entry.required.account");
    if ("errors" in result || brokerage === undefined) {
      setErrors(problems);
      setSummary(t("entry.fixFields"));
      return null;
    }
    setErrors({});
    setSummary(null);
    try {
      const done = await record.mutateAsync(result.body);
      return { id: done.transaction_id };
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
      return null;
    }
  };

  const reset = () => {
    setDraft({
      ...emptyFixedIncomeDraft(
        newId(),
        state.brokerage?.id ?? null,
        draft.appliedOn,
      ),
      instrument: draft.instrument,
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
    discard: () => undefined,
  };
}
