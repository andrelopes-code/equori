import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery, positionsQuery } from "@/features/accounts";
import { parseRate } from "@/features/instruments";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { actionPreview } from "@/features/transactions/action-entry/action-preview";
import {
  actionPreset,
  emptyAction,
  isActionDraft,
} from "@/features/transactions/action-entry/action-draft";
import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { useRecordCorporateAction } from "@/features/transactions/api";
import type { NewTransactionSearch } from "@/features/transactions/model/search";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

const draftKey = "new-corporate-action";

// The state of the corporate action form. The preview is the quantity of the day before the
// date, as the server reads it (A228 IO24); the server stays the source of what is stored.
export function useActionEntry(
  accountId: string | null,
  brokerageId: string | null = null,
  presets: NewTransactionSearch = {},
) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const record = useRecordCorporateAction();
  const accounts = useQuery(accountsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const instruments = useQuery(instrumentsQuery(api)).data?.items;

  const [draft, setDraft] = useState<ActionDraft>(() => {
    const stored = readStored(draftKey);
    const start = isActionDraft(stored)
      ? { ...emptyAction(today), ...stored }
      : emptyAction(today);
    return {
      ...start,
      ...actionPreset(presets),
      brokerageId: brokerageId ?? start.brokerageId,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  // A route that names a holding account stands for its brokerage and its investment.
  const holding = accounts.data?.find((a) => a.id === accountId);
  const preset =
    holding?.parent_id === undefined
      ? null
      : { brokerageId: holding.parent_id, instrument: holding.currency };
  const chosen =
    draft.brokerageId === null && draft.instrument === null && preset !== null
      ? preset
      : draft;
  const instrument = chosen.instrument;
  const state = useBrokerages(chosen.brokerageId, instrument);
  const { brokerage } = state;
  const positions = useQuery(positionsQuery(api, shiftDate(draft.date, -1)));
  const held = positions.data?.find(
    (p) => p.account_id === state.held?.id && p.instrument === instrument,
  );
  const quantityScale =
    scale === null || instrument === null ? null : scale(instrument);
  const preview =
    held === undefined || quantityScale === null
      ? null
      : actionPreview(
          held.quantity.amount,
          draft.ratioFrom ?? 0,
          draft.ratioTo ?? 0,
          quantityScale,
        );
  const view = {
    base,
    brokerages: state.brokerages,
    brokerage,
    instrument,
    fund: instruments?.find((i) => i.code === instrument)?.type === "fund",
    heldCodes: state.holdings.map((a) => a.currency),
    held: held?.quantity.amount,
    quantityScale,
    preview,
    ready: accounts.data !== undefined && base !== undefined && scale !== null,
  };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const bonus = draft.kind === "bonus";
    const unitTax = draft.kind === "unit_tax";
    const unitCost = bonus ? parseRate(draft.unitCost) : null;
    const problems: Record<string, string> = {};
    if (brokerage === undefined)
      problems.brokerage_id = t("entry.required.account");
    if (instrument === null)
      problems.instrument = t("trade.required.securityAccount");
    if (unitTax) {
      if (state.held === undefined)
        problems.instrument = t("trade.required.securityAccount");
      if (draft.quantity <= 0) problems.quantity = t("trade.required.quantity");
      if (draft.amount <= 0) problems.amount = t("entry.required.amount");
    } else {
      if ((draft.ratioFrom ?? 0) <= 0)
        problems.ratio_from = t("action.required.ratio");
      if ((draft.ratioTo ?? 0) <= 0)
        problems.ratio_to = t("action.required.ratio");
    }
    if (
      Object.keys(problems).length > 0 ||
      brokerage === undefined ||
      instrument === null ||
      (!unitTax && (draft.ratioFrom === null || draft.ratioTo === null))
    ) {
      setErrors(problems);
      setSummary(t("entry.fixFields"));
      return null;
    }
    setErrors({});
    setSummary(null);
    const description = draft.description.trim();
    const order: components["schemas"]["CorporateActionInput"] = unitTax
      ? {
          ...(state.held === undefined ? {} : { account_id: state.held.id }),
          kind: draft.kind,
          date: draft.date,
          ratio_from: 1,
          ratio_to: 1,
          quantity: { amount: draft.quantity, currency: instrument },
          amount: { amount: draft.amount, currency: base ?? "" },
          ...(description === "" ? {} : { description }),
        }
      : {
          brokerage_id: brokerage.id,
          instrument,
          kind: draft.kind,
          date: draft.date,
          ratio_from: draft.ratioFrom ?? 0,
          ratio_to: draft.ratioTo ?? 0,
          ...(unitCost === null ? {} : { unit_cost: unitCost }),
          ...(bonus && draft.categoryId !== null
            ? { category_id: draft.categoryId }
            : {}),
          ...(description === "" ? {} : { description }),
        };
    try {
      const created = await record.mutateAsync(order);
      clearDraft(draftKey);
      return created;
    } catch (error) {
      if (error instanceof ProblemError) setErrors(serverErrors(error));
      setSummary(errorText(error, t));
      return null;
    }
  };

  const reset = () => {
    // The next action keeps the brokerage, the investment, the event and the date.
    setDraft({
      ...emptyAction(draft.date, brokerage?.id ?? null),
      instrument,
      kind: draft.kind,
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

// The holding of an action is the investment field of the form.
function serverErrors(error: ProblemError): Record<string, string> {
  const { account_id: holding, ...rest } = fieldErrors(error.problem);

  return holding === undefined ? rest : { ...rest, instrument: holding };
}
