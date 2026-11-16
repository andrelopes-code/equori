import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { usePutTerms } from "@/features/instruments/api";
import {
  initialDraft,
  termsBody,
  type TermsDraft,
} from "@/features/instruments/terms/terms-draft";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Terms = components["schemas"]["FixedIncomeTerms"];

interface UseTermsDraftArgs {
  code: string;
  terms: Terms | null;
  onDone: () => void;
}

export function useTermsDraft({ code, terms, onDone }: UseTermsDraftArgs) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const put = usePutTerms();
  const [draft, setDraft] = useState(() => initialDraft(terms, today, locale));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const change = (patch: Partial<TermsDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    const outcome = termsBody(draft, t);
    setErrors(outcome.errors ?? {});
    setSummary(null);
    if (outcome.body === undefined) return;

    put
      .mutateAsync({ code, terms: outcome.body })
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

  return { draft, errors, summary, pending: put.isPending, change, submit };
}
