import { useQuery } from "@tanstack/react-query";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import {
  openingLossesQuery,
  useSaveOpeningLosses,
} from "@/features/portfolio/api";
import {
  lossRows,
  rowsToLosses,
} from "@/features/portfolio/gain-tax/opening-loss-rows";
import type { LossRow } from "@/features/portfolio/gain-tax/opening-loss-rows";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// LO4: the rows of the pools the region accepts, the reader's edits over the saved set and the
// save of the whole set.
export function useOpeningLosses() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const answer = useQuery(openingLossesQuery(api)).data;
  const currency = useQuery(settingsQuery(api)).data?.base_currency;
  const save = useSaveOpeningLosses();

  const [edits, setEdits] = useState<Record<string, Partial<LossRow>>>({});

  const rows = lossRows(
    answer?.pools ?? [],
    answer?.losses ?? [],
    today.slice(0, 7),
    edits,
  );

  function change(pool: string, patch: Partial<LossRow>) {
    setEdits((current) => ({
      ...current,
      [pool]: { ...current[pool], ...patch },
    }));
  }

  function submit() {
    if (currency === undefined) return;
    save.mutate(rowsToLosses(rows, currency), {
      onSuccess: () => {
        setEdits({});
        toast.show({
          tone: "secondary",
          title: t("gainTax.openingLosses.saved"),
        });
      },
    });
  }

  return { rows, change, submit, saving: save.isPending, error: save.error };
}
