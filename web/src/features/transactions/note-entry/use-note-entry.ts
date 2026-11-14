import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery, balanceQuery } from "@/features/accounts";
import { settingsQuery, useScale } from "@/features/setup";
import { useRecordBrokerageNote } from "@/features/transactions/api";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import { apportion } from "@/features/transactions/note-entry/apportion";
import {
  emptyNote,
  isNoteDraft,
} from "@/features/transactions/note-entry/note-draft";
import type { NoteDraft } from "@/features/transactions/note-entry/note-draft";
import {
  noteBody,
  noteProblems,
  orderGrosses,
} from "@/features/transactions/note-entry/note-model";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const draftKey = "note-draft";

export interface NoteView {
  base: string | undefined;
  brokerages: Account[];
  brokerage: Account | undefined;
  payers: Account[];
  payer: Account | undefined;
  baseCash: boolean;
  // Minor units of the base currency.
  balance: number | undefined;
  // Per order, in minor units of the base currency; null while the order is incomplete.
  grosses: (number | null)[];
  // Per order: its share of the costs of the note (A228 IO18).
  shares: number[];
  ready: boolean;
}

// The state of the brokerage note form: the draft, what the server's reads add to it (accounts of
// the brokerage, balance) and the write. The server allocates the costs; the shares here preview
// the same split.
export function useNoteEntry(brokerageId: string | null) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const record = useRecordBrokerageNote();
  const accounts = useQuery(accountsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const [draft, setDraft] = useState<NoteDraft>(() =>
    startDraft(today, brokerageId),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  const state = useBrokerages(draft.brokerageId, null);
  const payer =
    state.payers.find((a) => a.id === draft.cashAccountId) ?? state.payer;
  const balance = useQuery({
    ...balanceQuery(api, payer?.id ?? "", draft.date, "booked"),
    enabled: payer !== undefined,
  }).data?.balance.amount;

  const baseScale = scale === null || base === undefined ? null : scale(base);
  const grosses =
    scale === null || baseScale === null
      ? []
      : orderGrosses(draft.orders, scale, baseScale);
  const view: NoteView = {
    base,
    brokerages: state.brokerages,
    brokerage: state.brokerage,
    payers: state.payers,
    payer,
    baseCash: state.baseCash,
    balance,
    grosses,
    shares: apportion(
      draft.fees,
      grosses.map((gross) => gross ?? 0),
    ),
    ready: accounts.data !== undefined && base !== undefined && scale !== null,
  };

  async function submit(): Promise<Transaction | null> {
    const problems = noteProblems(draft, {
      brokerage: state.brokerage !== undefined,
      payer: payer !== undefined,
    });
    if (
      Object.keys(problems).length > 0 ||
      state.brokerage === undefined ||
      payer === undefined ||
      base === undefined
    ) {
      setErrors(translated(problems, t));
      setSummary(t("entry.fixFields"));
      return null;
    }

    setErrors({});
    setSummary(null);
    const ids = { brokerage: state.brokerage.id, payer: payer.id };
    try {
      const created = await record.mutateAsync(noteBody(draft, ids, base));
      clearDraft(draftKey);
      return created.transactions[0] ?? null;
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
      return null;
    }
  }

  function reset() {
    // The next note keeps the brokerage, the cash account and the date.
    setDraft({
      ...emptyNote(draft.date, state.brokerage?.id ?? null),
      cashAccountId: draft.cashAccountId,
    });
  }

  function discard() {
    clearDraft(draftKey);
  }

  return {
    draft,
    setDraft,
    errors,
    summary,
    view,
    submit,
    reset,
    discard,
    pending: record.isPending,
  };
}

function startDraft(today: string, brokerageId: string | null): NoteDraft {
  const stored = readStored(draftKey);
  const start = isNoteDraft(stored)
    ? { ...emptyNote(today), ...stored }
    : emptyNote(today);

  return { ...start, brokerageId: brokerageId ?? start.brokerageId };
}

function translated(
  problems: Record<string, MessageKey>,
  t: (key: MessageKey) => string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(problems).map(([field, key]) => [field, t(key)]),
  );
}
