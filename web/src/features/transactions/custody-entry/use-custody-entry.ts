import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery, positionsQuery } from "@/features/accounts";
import { settingsQuery, useScale } from "@/features/setup";
import { useRecordCustodyTransfer } from "@/features/transactions/api";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import {
  emptyCustody,
  isCustodyDraft,
} from "@/features/transactions/custody-entry/custody-draft";
import type { CustodyDraft } from "@/features/transactions/custody-entry/custody-draft";
import { custodyProblems } from "@/features/transactions/custody-entry/custody-problems";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

const draftKey = "new-custody-transfer";

// The state of the custody transfer form. The server stays the source of the cost that travels
// and of the quantity the holding has at the end of the date (A228 IO30).
export function useCustodyEntry(
  accountId: string | null,
  brokerageId: string | null = null,
) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const record = useRecordCustodyTransfer();
  const accounts = useQuery(accountsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const [draft, setDraft] = useState<CustodyDraft>(() => {
    const stored = readStored(draftKey);
    const start = isCustodyDraft(stored) ? stored : emptyCustody(today);

    return { ...start, brokerageId: brokerageId ?? start.brokerageId };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  // A route that names a holding account stands for its brokerage and its investment.
  const routed = accounts.data?.find((a) => a.id === accountId);
  const preset =
    routed?.parent_id === undefined
      ? null
      : { brokerageId: routed.parent_id, instrument: routed.currency };
  const chosen =
    draft.brokerageId === null && draft.instrument === null && preset !== null
      ? preset
      : draft;
  const instrument = chosen.instrument;
  const state = useBrokerages(chosen.brokerageId, instrument);
  const { brokerage, held: holding } = state;
  const positions = useQuery(positionsQuery(api, draft.date));
  const held = positions.data?.find(
    (p) => p.account_id === holding?.id && p.instrument === instrument,
  );
  const view = {
    base,
    brokerages: state.brokerages,
    brokerage,
    receivers: state.brokerages.filter((b) => b.id !== brokerage?.id),
    instrument,
    heldCodes: state.holdings.map((a) => a.currency),
    held,
    ready: accounts.data !== undefined && base !== undefined && scale !== null,
  };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const problems = custodyProblems(draft, { brokerage, holding }, t);
    if (
      Object.keys(problems).length > 0 ||
      holding === undefined ||
      draft.toId === null ||
      instrument === null
    ) {
      setErrors(problems);
      setSummary(t("entry.fixFields"));
      return null;
    }
    setErrors({});
    setSummary(null);
    const description = draft.description.trim();
    const order: components["schemas"]["CustodyTransferInput"] = {
      account_id: holding.id,
      brokerage_id: draft.toId,
      date: draft.date,
      quantity: { amount: draft.quantity, currency: instrument },
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
    // The next transfer keeps the giving brokerage, the investment and the date.
    setDraft({
      ...emptyCustody(draft.date, brokerage?.id ?? null),
      instrument,
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

// The holding that gives is the investment field; the brokerage that receives is `to`.
function serverErrors(error: ProblemError): Record<string, string> {
  const {
    account_id: holding,
    brokerage_id: receiver,
    ...rest
  } = fieldErrors(error.problem);

  return {
    ...rest,
    ...(holding === undefined ? {} : { instrument: holding }),
    ...(receiver === undefined ? {} : { to: receiver }),
  };
}
