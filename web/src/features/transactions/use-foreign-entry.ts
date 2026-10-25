import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { addMonths, cardsQuery, statementsQuery } from "@/features/cards";
import { pricesQuery, parseRate } from "@/features/instruments";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import {
  statementPlacementQuery,
  useRecordForeignPurchase,
} from "@/features/transactions/api";
import {
  emptyForeign,
  isForeignDraft,
} from "@/features/transactions/foreign-draft";
import type { ForeignDraft } from "@/features/transactions/foreign-draft";
import { chargeOf } from "@/features/transactions/foreign-math";
import {
  clearDraft,
  readStored,
  writeDraft,
} from "@/features/transactions/form-draft";
import { grossOf } from "@/features/transactions/trade-math";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

const draftKey = "new-foreign";
export const maxChargeBP = 10000;

// ISO 4217 codes the runtime knows; a code typed by hand is checked against them.
export function isCurrencyCode(code: string): boolean {
  return Intl.supportedValuesOf("currency").includes(code);
}

// The scale of a currency: the instrument list's when it has the code, else the runtime's.
export function currencyScale(
  code: string,
  scales: ReadonlyMap<string, number>,
): number {
  return (
    scales.get(code) ??
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits ??
    2
  );
}

export function chargeBPOf(text: string): number | null {
  if (!/^\d{1,5}$/.test(text)) return null;
  const bp = Number(text);
  return bp <= maxChargeBP ? bp : null;
}

// The state of the foreign purchase form. The server stores the amounts; the converted amount,
// the charge and the total here are a preview with the server's rounding.
export function useForeignEntry(cardId: string | null) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const record = useRecordForeignPurchase();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));

  const [draft, setDraft] = useState<ForeignDraft>(() => {
    const stored = readStored(draftKey);
    const start = isForeignDraft(stored) ? stored : emptyForeign(today);
    return cardId === null ? start : { ...start, cardId };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  const cards = useMemo(
    () =>
      (accounts.data ?? []).filter(
        (a: Account) =>
          a.kind === "credit_card" &&
          a.currency === base &&
          a.closed_on === undefined,
      ),
    [accounts.data, base],
  );
  const card =
    cards.find((a) => a.id === draft.cardId) ??
    (draft.cardId === null && cards.length === 1 ? cards[0] : undefined);

  const scales = useMemo(
    () =>
      new Map((instruments.data?.items ?? []).map((i) => [i.code, i.scale])),
    [instruments.data],
  );
  const currencies = useMemo(
    () =>
      (instruments.data?.items ?? [])
        .filter((i) => i.type === "currency" && i.code !== base)
        .map((i) => i.code)
        .sort(),
    [instruments.data, base],
  );
  const typed = draft.otherCurrency.trim().toUpperCase();
  const otherInvalid =
    typed !== "" && (typed === base || !isCurrencyCode(typed));
  const currency =
    typed !== "" ? (otherInvalid ? null : typed) : draft.currency;

  const cardRate = useQuery({
    ...cardsQuery(api, card?.id ?? ""),
    enabled: card !== undefined,
  }).data?.find((c) => c.active)?.foreign_charge_bp;
  const chargeText =
    draft.chargeBP ?? (cardRate === undefined ? "" : String(cardRate));
  const chargeBP = chargeBPOf(chargeText);

  const price = useQuery({
    ...pricesQuery(api, currency ?? "", base ?? "", draft.date, draft.date),
    enabled: currency !== null && base !== undefined,
  });
  const stored = price.data?.[0];
  const rateText = draft.rate ?? stored?.value ?? "";
  const rate = parseRate(rateText);

  const placement = useQuery({
    ...statementPlacementQuery(api, card?.id ?? "", draft.date),
    enabled: card !== undefined,
  });
  const statements = useQuery({
    ...statementsQuery(
      api,
      card?.id ?? "",
      addMonths(draft.date.slice(0, 7), -1),
    ),
    enabled: card !== undefined,
  });

  const baseScale = base === undefined ? 0 : (scales.get(base) ?? 0);
  const originalScale = currency === null ? 0 : currencyScale(currency, scales);
  const converted =
    rate !== null && draft.original > 0
      ? grossOf(draft.original, originalScale, rate, baseScale)
      : null;
  const charge =
    converted !== null && chargeBP !== null
      ? chargeOf(converted, chargeBP)
      : null;
  const view = {
    base,
    cards,
    card,
    currencies,
    currency,
    otherInvalid,
    originalScale,
    baseScale,
    chargeText,
    chargeBP,
    rateText,
    stored,
    priceLoading: price.isPending && price.fetchStatus !== "idle",
    placement: placement.data,
    statements: statements.data ?? [],
    converted,
    charge,
    total: converted === null ? null : converted + (charge ?? 0),
    ready:
      base !== undefined &&
      accounts.data !== undefined &&
      instruments.data !== undefined,
  };

  const submit = async (): Promise<
    components["schemas"]["Transaction"] | null
  > => {
    const problems: Record<string, string> = {};
    if (card === undefined)
      problems.account_id = t("foreignPurchase.required.card");
    if (currency === null)
      problems.original = t("foreignPurchase.required.currency");
    else if (draft.original <= 0)
      problems.original = t("entry.required.amount");
    if (rate === null) problems.rate = t("foreignPurchase.required.rate");
    if (draft.categoryId === null)
      problems.category_id = t("entry.required.category");
    if (chargeText !== "" && chargeBP === null)
      problems.foreign_charge_rate_bp = t("foreignPurchase.chargeRateInvalid");
    if (
      Object.keys(problems).length > 0 ||
      card === undefined ||
      currency === null ||
      rate === null ||
      draft.categoryId === null
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
        account_id: card.id,
        category_id: draft.categoryId,
        date: draft.date,
        original: { amount: draft.original, currency },
        rate,
        ...(description === "" ? {} : { description }),
        ...(draft.payeeId === null ? {} : { payee_id: draft.payeeId }),
        ...(chargeBP === null ? {} : { foreign_charge_rate_bp: chargeBP }),
        ...(draft.chargeCategoryId === null
          ? {}
          : { foreign_charge_category_id: draft.chargeCategoryId }),
        ...(draft.statement === null ? {} : { statement: draft.statement }),
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
    // The next purchase keeps the card, the date and the currency.
    setDraft({
      ...emptyForeign(draft.date, draft.cardId),
      currency: draft.currency,
      otherCurrency: draft.otherCurrency,
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
