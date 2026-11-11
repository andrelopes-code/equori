import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { subtypesQuery, useDefineInstrument } from "@/features/instruments/api";
import { instrumentTypes } from "@/features/instruments/instrument-groups";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/instrument-labels";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type InstrumentType = components["schemas"]["InstrumentType"];
type CatalogListing = components["schemas"]["CatalogListing"];

// Stands for "no subtype" in the select; a subtype matches ^[a-z0-9_]{2,40}$, so it never collides.
export const none = "-";

// State, queries and submit of the define dialog. The subtype choices come from the jurisdiction
// through listInstrumentSubtypes for the chosen type; a type without subtypes has none.
export function useInstrumentDefine(onDone: () => void) {
  const t = useT();
  const api = useApi();
  const define = useDefineInstrument();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const instruments = useQuery(instrumentsQuery(api));
  const [code, setCode] = useState("");
  const [type, setType] = useState<InstrumentType | null>(null);
  const [scale, setScale] = useState("");
  const [name, setName] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [exchange, setExchange] = useState("");
  const [subtype, setSubtype] = useState(none);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const subtypes = useQuery({
    ...subtypesQuery(api, type ?? "stock"),
    enabled: type !== null,
  });

  const subtypeChoices = useMemo(
    () => [
      { value: none, label: t("instruments.subtype.none") },
      ...(subtypes.data ?? []).map((s) => ({
        value: s,
        label: subtypeLabel(t, s),
      })),
    ],
    [subtypes.data, t],
  );
  const typeChoices = useMemo(
    () => instrumentTypes.map((v) => ({ value: v, label: typeLabel(t, v) })),
    [t],
  );
  const currencyChoices = useMemo(
    () =>
      (instruments.data?.items ?? [])
        .filter((i) => i.type === "currency")
        .map((i) => ({ value: i.code, label: `${i.code} ${i.name}` })),
    [instruments.data],
  );
  const chosenQuote = quote ?? base ?? null;

  const apply = (listing: CatalogListing) => {
    setCode(listing.code);
    setExchange(listing.exchange);
    if (listing.name !== "") setName(listing.name);
    if (listing.type !== undefined) {
      setType(listing.type);
      setSubtype(none);
    }
    if (listing.quote_currency !== "") setQuote(listing.quote_currency);
  };

  const submit = () => {
    const next: Record<string, string> = {};
    const required = t("instruments.required");
    if (code.trim() === "") next.code = required;
    if (type === null) next.type = required;
    if (scale.trim() === "") next.scale = required;
    if (name.trim() === "") next.name = required;
    if (chosenQuote === null) next.quote_currency = required;
    setErrors(next);
    setSummary(null);
    if (Object.keys(next).length > 0 || type === null || chosenQuote === null)
      return;
    define
      .mutateAsync({
        code: code.trim().toUpperCase(),
        type,
        scale: Number(scale),
        name: name.trim(),
        quote_currency: chosenQuote,
        ...(exchange.trim() === "" ? {} : { exchange: exchange.trim() }),
        ...(subtype === none ? {} : { subtype }),
      })
      .then(onDone)
      .catch((caught: unknown) => {
        const fields =
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {};
        setErrors(fields);
        setSummary(
          Object.keys(fields).length > 0 ? null : errorText(caught, t),
        );
      });
  };

  return {
    code,
    setCode,
    type,
    setType,
    scale,
    setScale,
    name,
    setName,
    quote,
    setQuote,
    exchange,
    setExchange,
    subtype,
    setSubtype,
    errors,
    summary,
    pending: define.isPending,
    subtypeChoices,
    typeChoices,
    currencyChoices,
    chosenQuote,
    apply,
    submit,
  };
}
