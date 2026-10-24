import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery, positionsQuery } from "@/features/accounts";
import { parseRate, pricesQuery } from "@/features/instruments";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { useRecordTrade } from "@/features/transactions/api";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/form-draft";
import { emptyTrade, isTradeDraft } from "@/features/transactions/trade-draft";
import type { TradeDraft } from "@/features/transactions/trade-draft";
import {
  cashEffect,
  estimatedResult,
  grossOf,
  saleCost,
} from "@/features/transactions/trade-math";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];
type Position = components["schemas"]["Position"];

const draftKey = "new-trade";

export interface TradeView {
  base: string | undefined;
  security: Account | undefined;
  securities: Account[];
  cashChoices: Account[];
  cashAccountId: string | null;
  price: string;
  storedPrice: string | undefined;
  held: Position | undefined;
  gross: number | null;
  cashEffect: number | null;
  result: number | null;
  ready: boolean;
}

// The state of the trade form: the draft, what the server's reads add to it (price, position,
// accounts of the brokerage) and the write. The server stays the source of what is stored; the
// figures here are a preview of A68.
export function useTradeEntry(accountId: string | null) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const record = useRecordTrade();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const base = settings.data?.base_currency;

  const [draft, setDraft] = useState<TradeDraft>(() => {
    const stored = readStored(draftKey);
    const start = isTradeDraft(stored) ? stored : emptyTrade(today);
    return accountId === null ? start : { ...start, accountId };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  const securities = useMemo(() => {
    const kinds = new Map(
      (instruments.data?.items ?? []).map((i) => [i.code, i.type]),
    );
    const all = accounts.data ?? [];
    const parents = new Set(all.map((a) => a.parent_id));
    return all.filter(
      (a) =>
        a.closed_on === undefined &&
        !parents.has(a.id) &&
        kinds.has(a.currency) &&
        kinds.get(a.currency) !== "currency",
    );
  }, [accounts.data, instruments.data]);
  const security =
    securities.find((a) => a.id === draft.accountId) ??
    (draft.accountId === null && securities.length === 1
      ? securities[0]
      : undefined);
  const cashChoices = useMemo(
    () =>
      security?.parent_id === undefined
        ? []
        : (accounts.data ?? []).filter(
            (a) =>
              a.parent_id === security.parent_id &&
              a.class === "asset" &&
              a.currency === base &&
              a.closed_on === undefined,
          ),
    [accounts.data, security, base],
  );
  // One cash account leaves nothing to choose.
  const cashAccountId = cashChoices.some((a) => a.id === draft.cashAccountId)
    ? draft.cashAccountId
    : cashChoices.length === 1
      ? (cashChoices[0]?.id ?? null)
      : null;

  const instrument = security?.currency;
  const prices = useQuery({
    ...pricesQuery(api, instrument ?? "", base ?? "", draft.date, draft.date),
    enabled: instrument !== undefined && base !== undefined,
  });
  const positions = useQuery(positionsQuery(api, draft.date));
  const storedPrice = prices.data?.[0]?.value;
  const price = draft.unitPrice ?? storedPrice ?? "";
  const rate = parseRate(price);
  const held = positions.data?.find(
    (p) => p.account_id === security?.id && p.instrument === instrument,
  );

  const quantityScale =
    scale === null || instrument === undefined ? null : scale(instrument);
  const baseScale = scale === null || base === undefined ? null : scale(base);
  const priced =
    rate !== null &&
    draft.quantity > 0 &&
    quantityScale !== null &&
    baseScale !== null;
  const gross = priced
    ? grossOf(draft.quantity, quantityScale, rate, baseScale)
    : null;
  const taxes = draft.side === "sell" ? draft.taxes : 0;
  const heldQuantity = held?.quantity.amount ?? 0;
  const cost =
    gross !== null &&
    draft.side === "sell" &&
    held !== undefined &&
    draft.quantity <= heldQuantity
      ? saleCost(held.cost_basis.amount, draft.quantity, heldQuantity)
      : null;

  // A sale is limited to the position of the date; before the position loads nothing is refused.
  const limit: string | null =
    draft.side === "sell" &&
    draft.quantity > 0 &&
    quantityScale !== null &&
    positions.data !== undefined &&
    draft.quantity > heldQuantity
      ? held === undefined
        ? t("trade.noPosition")
        : t("trade.exceedsPosition", {
            quantity: fmt.plain(held.quantity, quantityScale),
          })
      : null;

  const view: TradeView = {
    base,
    security,
    securities,
    cashChoices,
    cashAccountId,
    price,
    storedPrice,
    held,
    gross,
    cashEffect:
      gross === null ? null : cashEffect(draft.side, gross, draft.fees, taxes),
    result:
      gross === null || cost === null
        ? null
        : estimatedResult(gross, draft.fees, cost),
    ready: accounts.data !== undefined && base !== undefined && scale !== null,
  };
  const shown = limit === null ? errors : { ...errors, quantity: limit };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const problems: Record<string, string> = {};
    if (security === undefined)
      problems.account_id = t("trade.required.securityAccount");
    if (cashAccountId === null)
      problems.cash_account_id = t("trade.required.cashAccount");
    if (draft.quantity <= 0) problems.quantity = t("trade.required.quantity");
    if (rate === null) problems.unit_price = t("trade.required.price");
    if (limit !== null) problems.quantity = limit;
    if (
      Object.keys(problems).length > 0 ||
      security === undefined ||
      cashAccountId === null ||
      rate === null ||
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
        account_id: security.id,
        cash_account_id: cashAccountId,
        side: draft.side,
        date: draft.date,
        quantity: { amount: draft.quantity, currency: security.currency },
        unit_price: rate,
        ...(draft.fees > 0
          ? { fees: { amount: draft.fees, currency: base } }
          : {}),
        ...(taxes > 0 ? { taxes: { amount: taxes, currency: base } } : {}),
        ...(taxes > 0 && draft.taxesCategoryId !== null
          ? { taxes_category_id: draft.taxesCategoryId }
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
    // The next trade keeps the account, the side and the date.
    setDraft({
      ...emptyTrade(draft.date, draft.accountId),
      side: draft.side,
      cashAccountId: draft.cashAccountId,
    });
  };

  return {
    draft,
    setDraft,
    errors: shown,
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
