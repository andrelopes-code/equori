import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useEditInstrument } from "@/features/instruments/api";
import { useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];

// FR15: links the instrument to one fund of a fund report source by writing the fund's identifier
// as the instrument's symbol for that source; every other stored field is sent back unchanged.
export function useLinkFund(instrument: Instrument) {
  const t = useT();
  const edit = useEditInstrument();
  const [failure, setFailure] = useState<string | null>(null);

  const link = (source: string, identifier: string) => {
    setFailure(null);
    edit
      .mutateAsync({
        code: instrument.code,
        edit: {
          name: instrument.name,
          ...(instrument.exchange === undefined
            ? {}
            : { exchange: instrument.exchange }),
          ...(instrument.subtype === undefined
            ? {}
            : { subtype: instrument.subtype }),
          ...(instrument.issuer === undefined
            ? {}
            : { issuer: instrument.issuer }),
          symbols: { ...instrument.symbols, [source]: identifier },
        },
      })
      .catch((caught: unknown) => {
        setFailure(errorText(caught, t));
      });
  };

  return { link, linking: edit.isPending, failure };
}
