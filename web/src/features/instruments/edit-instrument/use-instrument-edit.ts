import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useEditInstrument } from "@/features/instruments/api";
import { symbolsEdit } from "@/features/instruments/edit-instrument/symbols-edit";
import { useT } from "@/i18n/i18n-provider";

// Stands for "no subtype" in the select; a subtype matches ^[a-z0-9_]{2,40}$, so it never collides.
export const none = "-";

export function useInstrumentEdit(
  instrument: components["schemas"]["Instrument"],
  onDone: () => void,
) {
  const t = useT();
  const edit = useEditInstrument();
  const [name, setName] = useState(instrument.name);
  const [exchange, setExchange] = useState(instrument.exchange ?? "");
  const [subtype, setSubtype] = useState(instrument.subtype ?? none);
  const [symbols, setSymbols] = useState(instrument.symbols ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const submit = () => {
    setSummary(null);
    if (name.trim() === "") {
      setErrors({ name: t("instruments.required") });
      return;
    }
    const change = symbolsEdit(instrument.symbols, symbols);
    if (change.invalid.length > 0) {
      setErrors(
        Object.fromEntries(
          change.invalid.map((id) => [
            `symbols.${id}`,
            t("instruments.symbol.invalid"),
          ]),
        ),
      );
      return;
    }
    setErrors({});
    edit
      .mutateAsync({
        code: instrument.code,
        edit: {
          name: name.trim(),
          ...(exchange.trim() === "" ? {} : { exchange: exchange.trim() }),
          ...(subtype === none ? {} : { subtype }),
          ...(change.symbols === undefined ? {} : { symbols: change.symbols }),
        },
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
    name,
    setName,
    exchange,
    setExchange,
    subtype,
    setSubtype,
    symbols,
    setSymbols,
    errors,
    summary,
    isPending: edit.isPending,
    submit,
  };
}
