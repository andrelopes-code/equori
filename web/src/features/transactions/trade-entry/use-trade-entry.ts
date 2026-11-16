import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  accountLotsQuery,
  accountsQuery,
  accountWithholdingQuery,
  balanceQuery,
  positionsQuery,
} from "@/features/accounts";
import { parseRate, pricesQuery } from "@/features/instruments";
import { settingsQuery, useScale } from "@/features/setup";
import { useCorrectTrade, useRecordTrade } from "@/features/transactions/api";
import {
  balanceWithout,
  positionWithout,
} from "@/features/transactions/correction/without-original";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import {
  emptyTrade,
  isTradeDraft,
  storedTrade,
} from "@/features/transactions/trade-entry/trade-draft";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import { unitPriceOfTotal } from "@/features/transactions/trade-entry/unit-price-of-total";
import { shortfall } from "@/features/transactions/brokerage-account/cash-state";
import { useBrokerages } from "@/features/transactions/brokerage-account/use-brokerages";
import {
  cashEffect,
  estimatedResult,
  grossOf,
  soldCost,
} from "@/features/transactions/entry-model/trade-math";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];
type Position = components["schemas"]["Position"];
type Transaction = components["schemas"]["Transaction"];

const draftKey = "new-trade";

// A227: the stored trade a correction replaces, the form it opens on and the reason typed.
export interface TradeCorrection {
  transaction: Transaction;
  start: TradeDraft;
  reason: string;
}

export interface TradeView {
  base: string | undefined;
  brokerages: Account[];
  brokerage: Account | undefined;
  instrument: string | null;
  // The codes the brokerage holds, for a sale; null for a purchase.
  heldCodes: string[] | null;
  payers: Account[];
  payer: Account | undefined;
  baseCash: boolean;
  // Minor units of the base currency.
  balance: number | undefined;
  shortfall: number | null;
  price: string;
  storedPrice: string | undefined;
  held: Position | undefined;
  gross: number | null;
  cashEffect: number | null;
  result: number | null;
  // Income tax plus IOF a sale of a taxed fixed income security withholds, an estimate (A235).
  withheld: number | null;
  ready: boolean;
}

// The state of the trade form: the draft, what the server's reads add to it (price, position,
// accounts of the brokerage) and the write. The server stays the source of what is stored; the
// figures here are a preview of A68 and A234. A correction keeps no draft in the browser and reads the
// position and the balance without the trade it replaces (A227 IC10).
export function useTradeEntry(
  accountId: string | null,
  brokerageId: string | null = null,
  correction?: TradeCorrection,
) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const record = useRecordTrade();
  const correct = useCorrectTrade();
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const base = settings.data?.base_currency;

  const [draft, setDraft] = useState<TradeDraft>(() => {
    if (correction !== undefined) return correction.start;
    const stored = readStored(draftKey);
    const start = isTradeDraft(stored)
      ? storedTrade(stored, today)
      : emptyTrade(today);
    return {
      ...start,
      brokerageId: brokerageId ?? start.brokerageId,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const correcting = correction !== undefined;
  useEffect(() => {
    if (!correcting) writeDraft(draftKey, draft);
  }, [draft, correcting]);

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
  const sell = draft.side === "sell";
  const state = useBrokerages(chosen.brokerageId, instrument);
  const payer =
    state.payers.find((a) => a.id === draft.cashAccountId) ?? state.payer;
  const balanceRead = useQuery({
    ...balanceQuery(api, payer?.id ?? "", draft.date, "booked"),
    enabled: payer !== undefined,
  });
  const balance = balanceWithout(
    balanceRead.data?.balance.amount,
    correction?.transaction,
    payer?.id,
    draft.date,
  );

  const prices = useQuery({
    ...pricesQuery(api, instrument ?? "", base ?? "", draft.date, draft.date),
    enabled: instrument !== null && base !== undefined,
  });
  const positions = useQuery(positionsQuery(api, draft.date));
  const storedPrice = prices.data?.[0]?.value;
  const held = positionWithout(
    positions.data?.find(
      (p) => p.account_id === state.held?.id && p.instrument === instrument,
    ),
    correction?.transaction,
    state.held?.id,
    draft.date,
  );

  const lots = useQuery({
    ...accountLotsQuery(
      api,
      state.held?.id ?? "",
      draft.date,
      correction?.transaction.id,
    ),
    enabled: sell && state.held !== undefined,
  });

  const quantityScale =
    scale === null || instrument === null ? null : scale(instrument);
  const baseScale = scale === null || base === undefined ? null : scale(base);
  const price = draft.unitPrice ?? storedPrice ?? "";
  const byTotal = draft.priceBasis === "total";
  const rate =
    byTotal && baseScale !== null && quantityScale !== null
      ? unitPriceOfTotal(draft.total, baseScale, draft.quantity, quantityScale)
      : parseRate(price);
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
  // The server removes cost by lot or at the average by account (A234): the preview follows its
  // answer and shows no cost before it arrives.
  const cost =
    gross !== null &&
    draft.side === "sell" &&
    held !== undefined &&
    draft.quantity <= heldQuantity &&
    lots.data !== undefined
      ? soldCost(
          lots.data,
          held.cost_basis.amount,
          draft.quantity,
          heldQuantity,
        )
      : null;

  const withholding = useQuery({
    ...accountWithholdingQuery(
      api,
      state.held?.id ?? "",
      draft.date,
      draft.quantity,
      gross ?? 0,
    ),
    enabled:
      correction === undefined &&
      sell &&
      state.held !== undefined &&
      gross !== null &&
      draft.quantity > 0 &&
      draft.quantity <= heldQuantity &&
      lots.data?.estimates_withholding === true,
  });
  const withheld =
    withholding.data === undefined
      ? null
      : withholding.data.income_tax.amount + withholding.data.iof.amount;

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

  const cashEffectValue =
    gross === null ? null : cashEffect(draft.side, gross, draft.fees, taxes);
  const view: TradeView = {
    base,
    brokerages: state.brokerages,
    brokerage: state.brokerage,
    instrument,
    heldCodes: sell ? state.holdings.map((a) => a.currency) : null,
    payers: state.payers,
    payer,
    baseCash: state.baseCash,
    balance,
    shortfall: shortfall(cashEffectValue, balance),
    price: byTotal ? (rate ?? "") : price,
    storedPrice,
    held,
    gross,
    cashEffect: cashEffectValue,
    result:
      gross === null || cost === null
        ? null
        : estimatedResult(gross, draft.fees, cost),
    withheld,
    ready: accounts.data !== undefined && base !== undefined && scale !== null,
  };
  const shown = limit === null ? errors : { ...errors, quantity: limit };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const problems: Record<string, string> = {};
    if (state.brokerage === undefined)
      problems.brokerage_id = t("entry.required.account");
    if (instrument === null)
      problems.instrument = t("trade.required.securityAccount");
    if (payer === undefined)
      problems.cash_account_id = t("trade.required.cashAccount");
    if (draft.quantity <= 0) problems.quantity = t("trade.required.quantity");
    if (rate === null && !byTotal)
      problems.unit_price = t("trade.required.price");
    if (rate === null && byTotal && (draft.total === 0 || draft.quantity > 0))
      problems.unit_price = t("trade.required.total");
    if (limit !== null) problems.quantity = limit;
    if (correction?.reason.trim() === "")
      problems.reason = t("correct.reasonRequired");
    if (
      Object.keys(problems).length > 0 ||
      state.brokerage === undefined ||
      instrument === null ||
      payer === undefined ||
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
    const order: components["schemas"]["TradeInput"] = {
      brokerage_id: state.brokerage.id,
      instrument,
      cash_account_id: payer.id,
      side: draft.side,
      date: draft.date,
      ...(draft.settlementDate === null
        ? {}
        : { settlement_date: draft.settlementDate }),
      quantity: { amount: draft.quantity, currency: instrument },
      unit_price: rate,
      ...(draft.fees > 0
        ? { fees: { amount: draft.fees, currency: base } }
        : {}),
      ...(taxes > 0 ? { taxes: { amount: taxes, currency: base } } : {}),
      ...(taxes > 0 && draft.taxesCategoryId !== null
        ? { taxes_category_id: draft.taxesCategoryId }
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
            trade: order,
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
    // The next trade keeps the brokerage, the investment, the side and the date.
    setDraft({
      ...emptyTrade(draft.date, state.brokerage?.id ?? null),
      instrument,
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
    pending: record.isPending || correct.isPending,
    discard: () => {
      clearDraft(draftKey);
    },
  };
}
