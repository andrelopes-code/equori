import { useEffect, useMemo, useState } from "react";

import { errorText } from "@/api/problem";
import { readText } from "@/features/accounts";
import { useRecordInstrumentPrices } from "@/features/instruments/api";
import { readPriceSeries } from "@/features/instruments/price-import/price-series";
import { useT } from "@/i18n/i18n-provider";
import { useDebounced } from "@/ui/runtime/use-debounced";

export interface SeriesChoice {
  dateColumn?: string;
  valueColumn?: string;
}

export const maxPrices = 20_000;

const settleMs = 300;

// The text of a pasted table or of a chosen file, read in the browser; the server counts what a
// record would change (a dry run) and stores the series only on record().
export function usePriceSeriesImport(code: string, quote: string) {
  const t = useT();
  const dry = useRecordInstrumentPrices();
  const real = useRecordInstrumentPrices();
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<SeriesChoice>({});

  const series = useMemo(() => readPriceSeries(text, choice), [text, choice]);
  const settled = useDebounced(series, settleMs);
  const valid = series.prices.length >= 1 && series.prices.length <= maxPrices;
  const failure = real.error ?? dry.error;

  const { mutate: sendDry } = dry;
  useEffect(() => {
    if (settled.prices.length < 1 || settled.prices.length > maxPrices) return;
    sendDry({ code, quote, prices: settled.prices, dryRun: true });
  }, [settled, code, quote, sendDry]);

  const counts = settled === series && valid ? dry.data : undefined;
  const recorded = real.data ?? null;
  const problem = failure === null ? null : errorText(failure, t);

  function changeText(next: string) {
    setText(next);
    setChoice({});
  }

  function changeChoice(next: SeriesChoice) {
    setChoice((current) => ({ ...current, ...next }));
  }

  function loadFile(file: Blob | undefined) {
    if (file !== undefined) void readText(file).then(changeText);
  }

  function record() {
    real.mutate({ code, quote, prices: series.prices, dryRun: false });
  }

  return {
    text,
    series,
    valid,
    counts,
    recorded,
    problem,
    recording: real.isPending,
    changeText,
    changeChoice,
    loadFile,
    record,
  };
}
