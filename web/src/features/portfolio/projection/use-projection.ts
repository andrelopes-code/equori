import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  projectionQuery,
  returnSeriesQuery,
  useDeleteProjection,
  useSaveProjection,
} from "@/features/portfolio/api";
import { periodDays } from "@/features/portfolio/return/portfolio-period";
import {
  annualRate,
  realReturn,
} from "@/features/portfolio/results/model/return-figures";
import { journeyMonths } from "@/features/portfolio/projection/journey-block/journey-months";
import { ageAt } from "@/features/portfolio/projection/model/age-at";
import {
  draftFrom,
  fieldsFromPlan,
  planInput,
  restFields,
} from "@/features/portfolio/projection/model/plan-fields";
import type {
  PlanFields,
  ProjectionDraft,
} from "@/features/portfolio/projection/model/plan-fields";
import { meQuery } from "@/features/session";
import { settingsQuery } from "@/features/setup";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

export type ProjectionPhase =
  "pending" | "failed" | "currency" | "nobirth" | "empty" | "ready";

export type Projection = ReturnType<typeof useProjection>;

// PX2, PX3, PX11, PX12: the plan, the history at month step in the plan currency and the birth
// date; the draft follows the fields as typed, from the stored plan or from the fields at rest.
export function useProjection() {
  const api = useApi();
  const today = useToday();
  const [locale] = useAppLocale();
  const queryClient = useQueryClient();

  const planRead = useQuery(projectionQuery(api));
  const me = useQuery(meQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const save = useSaveProjection();
  const remove = useDeleteProjection();

  const plan = planRead.data;
  const currency = plan?.currency ?? base;
  const history = useQuery(
    returnSeriesQuery(api, null, undefined, today, "month", currency, true),
  );

  const [edited, setEdited] = useState<PlanFields | null>(null);
  const [editedChanges, setEditedChanges] = useState<
    components["schemas"]["ProjectionChange"][] | null
  >(null);
  const [building, setBuilding] = useState(false);

  const fields = edited ?? (plan ? fieldsFromPlan(plan, locale) : restFields);
  const changes = editedChanges ??
    plan?.changes ?? [{ month: `${today.slice(0, 7)}-01`, amount: 0 }];
  const birthDate = me.data?.birth_date;
  const age = birthDate === undefined ? null : ageAt(birthDate, today);
  const draft: ProjectionDraft | null =
    currency === undefined ? null : draftFrom(fields, changes, currency);
  const span =
    draft === null || birthDate === undefined
      ? null
      : journeyMonths(today, birthDate, draft.withdrawalAge, draft.lastAge);
  const started = span !== null && span.withdrawalFrom <= today.slice(0, 7);
  const ended = span?.months.length === 0;
  const phase = phaseOf({
    failed: planRead.isError || me.isError,
    pending: planRead.isPending || me.isPending || base === undefined,
    currencyChanged:
      plan !== undefined && plan !== null && plan.currency !== base,
    birth: birthDate !== undefined,
    empty: plan === null && !building,
  });

  const series = history.data;
  const inflation = series?.indexes.find((i) => i.period === "month");
  const real =
    series === undefined || inflation === undefined
      ? null
      : realReturn(series.points, inflation.points);
  const annualReal =
    series === undefined || real === null
      ? null
      : annualRate(real.value, periodDays(series.from, real.until));

  function change(patch: Partial<PlanFields>) {
    setEdited({ ...fields, ...patch });
  }

  function saveDraft() {
    if (draft === null) return;

    save.mutate(planInput(draft), {
      onSuccess: (saved) => {
        queryClient.setQueryData(projectionQuery(api).queryKey, saved);
        setEdited(null);
        setEditedChanges(null);
      },
    });
  }

  function removePlan() {
    remove.mutate(undefined, {
      onSuccess: () => {
        setEdited(null);
        setEditedChanges(null);
        setBuilding(false);
      },
    });
  }

  return {
    phase,
    error: planRead.error ?? me.error,
    retry: () => {
      void planRead.refetch();
      void me.refetch();
    },
    fields,
    change,
    setChanges: setEditedChanges,
    draft,
    birthDate,
    age,
    history: series,
    annualReal,
    currency,
    base,
    planCurrency: plan?.currency,
    baseline: plan?.baseline,
    started,
    ended,
    save: { run: saveDraft, pending: save.isPending, error: save.error },
    remove: { run: removePlan, pending: remove.isPending },
    build: () => {
      setBuilding(true);
    },
  };
}

function phaseOf(state: {
  failed: boolean;
  pending: boolean;
  currencyChanged: boolean;
  birth: boolean;
  empty: boolean;
}): ProjectionPhase {
  if (state.failed) return "failed";
  if (state.pending) return "pending";
  if (state.currencyChanged) return "currency";
  if (!state.birth) return "nobirth";

  return state.empty ? "empty" : "ready";
}
