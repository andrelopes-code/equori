import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCreateTransaction } from "@/features/transactions/api";
import {
  emptyDraft,
  inputFromDraft,
} from "@/features/transactions/entry-model/entry-kind";
import type { EntryDraft } from "@/features/transactions/entry-model/entry-kind";
import { draftProblems } from "@/features/transactions/entry-model/entry-validation";
import { fieldOf } from "@/features/transactions/entry-model/field-of";
import { clearDraft } from "@/features/transactions/entry-model/form-draft";
import { draftKey } from "@/features/transactions/new-entry/draft-key";
import { useAnnounce } from "@/features/transactions/new-entry/use-announce";
import type { useBuiltEntries } from "@/features/transactions/new-entry/use-built-entries";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Built = ReturnType<typeof useBuiltEntries>;

interface SubmitEntryInput {
  draft: EntryDraft;
  setDraft: Dispatch<SetStateAction<EntryDraft>>;
  built: Built;
  base: string | undefined;
  accounts: Account[] | undefined;
}

// Saves the entry in the form: a built kind through its own hook, a posting kind through the
// transaction write. Holds the errors and the summary of the posting form.
export function useSubmitEntry({
  draft,
  setDraft,
  built,
  base,
  accounts,
}: SubmitEntryInput) {
  const t = useT();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const create = useCreateTransaction();
  const accountsById = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a])),
    [accounts],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const submit = async (next: "list" | "another") => {
    if (built.entry !== null) {
      await submitBuilt(next, built.entry);
      return;
    }
    if (base === undefined) return;
    const problems = draftProblems(draft, accountsById, base);
    if (Object.keys(problems).length > 0) {
      setErrors(
        Object.fromEntries(
          Object.entries(problems).map(([field, key]) => [field, t(key)]),
        ),
      );
      setSummary(t("entry.fixFields"));
      return;
    }
    setErrors({});
    setSummary(null);
    try {
      const created = await create.mutateAsync(
        inputFromDraft(draft, accountsById, base),
      );
      clearDraft(draftKey);
      announce(created.id, t("entry.created"));
      if (next === "list") {
        void navigate({ to: "/transactions" });
      } else {
        // The next entry keeps how and where money moved, and when.
        setDraft({
          ...emptyDraft(draft.date, draft.accountId),
          kind: draft.kind,
          toAccountId: draft.toAccountId,
        });
      }
    } catch (error) {
      if (error instanceof ProblemError) {
        const byField = fieldErrors(error.problem);
        setErrors(
          Object.fromEntries(
            Object.entries(byField).map(([field, message]) => [
              fieldOf(draft.kind, field),
              message,
            ]),
          ),
        );
      }
      setSummary(errorText(error, t));
    }
  };

  const submitBuilt = async (
    next: "list" | "another",
    active: NonNullable<Built["entry"]>,
  ) => {
    const created = await active.submit();
    if (created === null) return;
    if (next === "list") {
      void navigate({ to: "/transactions/$id", params: { id: created.id } });
      return;
    }
    announce(created.id, t(built.createdKey ?? "income.created"));
    active.reset();
  };

  return { submit, errors, summary, creating: create.isPending };
}
