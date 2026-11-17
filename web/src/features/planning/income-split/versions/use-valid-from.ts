import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { budgetBucketVersionsQuery } from "@/features/planning/api";
import {
  fromChoices,
  lastMonthOf,
} from "@/features/planning/income-split/versions/bucket-versions";
import { useToday } from "@/i18n/today";

// The field Valid from of the dialog (A240): the versions of the book, the choices for the
// month on screen and the one chosen; from preselects a start.
export function useValidFrom(month: string, from: string | undefined) {
  const api = useApi();
  const today = useToday().slice(0, 7);
  const query = useQuery(budgetBucketVersionsQuery(api));
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const versions = query.data?.versions ?? [];
  const choices = fromChoices(versions, month, today);
  const chosen =
    choices.find((c) => c.from === picked) ??
    choices.find((c) => c.from === from) ??
    choices.find((c) => c.from === month) ??
    choices[0];
  const start = chosen?.from ?? month;

  return {
    pending: query.isPending,
    choices,
    chosen,
    start,
    until: lastMonthOf(versions, start),
    choose: setPicked,
  };
}
