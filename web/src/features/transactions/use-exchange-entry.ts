import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { pricesQuery } from "@/features/instruments";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { useExchangeCurrency } from "@/features/transactions/api";
import {
  emptyExchange,
  isExchangeDraft,
} from "@/features/transactions/exchange-draft";
import type { ExchangeDraft } from "@/features/transactions/exchange-draft";
import { differenceBP, ratioText } from "@/features/transactions/foreign-math";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/form-draft";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

const draftKey = "new-exchange";

// The state of the currency exchange form. One of the two currencies is the base currency, so the
// destination list depends on the origin: another currency from a base-currency origin, the base
// currency from any other. The rates and the total are a preview; the server stores the amounts.
export function useExchangeEntry(accountId: string | null) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const record = useExchangeCurrency();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));

  const [draft, setDraft] = useState<ExchangeDraft>(() => {
    const stored = readStored(draftKey);
    const start = isExchangeDraft(stored) ? stored : emptyExchange(today);
    return accountId === null ? start : { ...start, fromId: accountId };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  const balance = useMemo(() => {
    const all = accounts.data ?? [];
    const parents = new Set(all.map((a) => a.parent_id));
    return all.filter(
      (a) =>
        a.class === "asset" && a.closed_on === undefined && !parents.has(a.id),
    );
  }, [accounts.data]);
  const from: Account | undefined = balance.find((a) => a.id === draft.fromId);
  const toChoices = useMemo(
    () =>
      balance.filter(
        (a) =>
          a.id !== from?.id &&
          (from === undefined ||
            (from.currency === base
              ? a.currency !== base
              : a.currency === base)),
      ),
    [balance, from, base],
  );
  const to: Account | undefined = toChoices.find((a) => a.id === draft.toId);

  const scales = useMemo(
    () =>
      new Map((instruments.data?.items ?? []).map((i) => [i.code, i.scale])),
    [instruments.data],
  );
  const scaleOf = (code: string | undefined) =>
    code === undefined ? 0 : (scales.get(code) ?? 0);
  const fromBase = from !== undefined && from.currency === base;
  const foreign = fromBase ? to : from;
  const foreignCode =
    to === undefined || from === undefined ? undefined : foreign?.currency;

  const price = useQuery({
    ...pricesQuery(api, foreignCode ?? "", base ?? "", draft.date, draft.date),
    enabled: foreignCode !== undefined && base !== undefined,
  });
  const stored = price.data?.[0];

  const baseAmount = fromBase ? draft.fromAmount : draft.toAmount;
  const foreignAmount = fromBase ? draft.toAmount : draft.fromAmount;
  const known =
    foreignCode !== undefined &&
    base !== undefined &&
    baseAmount > 0 &&
    foreignAmount > 0;
  const rate = known
    ? ratioText(baseAmount, scaleOf(base), foreignAmount, scaleOf(foreignCode))
    : null;
  const inverse = known
    ? ratioText(foreignAmount, scaleOf(foreignCode), baseAmount, scaleOf(base))
    : null;
  const view = {
    base,
    from,
    to,
    fromChoices: balance,
    toChoices,
    foreignCode,
    baseScale: scaleOf(base),
    fromScale: scaleOf(from?.currency),
    toScale: scaleOf(to?.currency),
    rate,
    inverse,
    stored,
    difference:
      rate !== null && stored !== undefined
        ? differenceBP(rate, stored.value)
        : null,
    // The fee is in the base currency, which is the currency of the origin when it is debited there.
    totalDebited:
      from === undefined || draft.fromAmount <= 0
        ? null
        : draft.fromAmount + (fromBase ? draft.fee : 0),
    ready:
      base !== undefined &&
      accounts.data !== undefined &&
      instruments.data !== undefined,
  };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const problems: Record<string, string> = {};
    if (from === undefined)
      problems.from_account_id = t("exchange.required.fromAccount");
    if (to === undefined)
      problems.to_account_id = t("exchange.required.toAccount");
    if (draft.fromAmount <= 0)
      problems.from_amount = t("entry.required.amount");
    if (draft.toAmount <= 0) problems.to_amount = t("entry.required.amount");
    if (
      Object.keys(problems).length > 0 ||
      from === undefined ||
      to === undefined ||
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
        from_account_id: from.id,
        to_account_id: to.id,
        date: draft.date,
        from_amount: { amount: draft.fromAmount, currency: from.currency },
        to_amount: { amount: draft.toAmount, currency: to.currency },
        ...(description === "" ? {} : { description }),
        ...(draft.fee > 0
          ? { fee: { amount: draft.fee, currency: base } }
          : {}),
        ...(draft.fee > 0 && draft.feeCategoryId !== null
          ? { fee_category_id: draft.feeCategoryId }
          : {}),
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
    // The next exchange keeps the accounts and the date.
    setDraft({ ...emptyExchange(draft.date, draft.fromId), toId: draft.toId });
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
