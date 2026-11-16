import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { useSaveBudgetBuckets } from "@/features/planning/api";
import {
  applyPreset,
  bucketsPayload,
  canSave,
  changeBucket,
  initialDraft,
  keepChoices,
  maxBuckets,
} from "@/features/planning/income-split/bucket-draft";
import type {
  BucketDraft,
  DraftBucket,
  PresetName,
} from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

type Bucket = components["schemas"]["BudgetBucket"];

// The draft of the income split dialog and its save (income buckets spec 5): nothing reaches
// the server before Save split or Remove split.
export function useBucketDraft(
  stored: readonly Bucket[] | undefined,
  entries: readonly CategoryEntry[],
  onDone: () => void,
) {
  const t = useT();
  const save = useSaveBudgetBuckets();
  const [draft, setDraft] = useState<BucketDraft>(() =>
    initialDraft(stored, entries),
  );
  const [failure, setFailure] = useState<string | null>(null);

  const setBucket = (key: string, change: Partial<DraftBucket>) => {
    setDraft({ ...draft, buckets: changeBucket(draft.buckets, key, change) });
  };

  const removeBucket = (key: string) => {
    const buckets = draft.buckets.filter((b) => b.key !== key);
    setDraft({ ...draft, buckets, choices: keepChoices(draft, buckets) });
  };

  const addBucket = () => {
    if (draft.buckets.length >= maxBuckets) return;
    const bucket = {
      key: crypto.randomUUID(),
      name: "",
      share: "0",
      measure: "ceiling" as const,
    };
    setDraft({ ...draft, buckets: [...draft.buckets, bucket] });
  };

  const setChoices = (choices: Map<string, string>) => {
    setDraft({ ...draft, choices });
  };

  const preset = (name: PresetName) => {
    setDraft(
      applyPreset(
        draft,
        name,
        (key) => t(key),
        () => crypto.randomUUID(),
      ),
    );
  };

  const write = (
    body: components["schemas"]["BudgetBucketsInput"],
    done: string,
  ) => {
    save.mutate(body, {
      onSuccess: () => {
        toast.show({ tone: "success", title: done });
        onDone();
      },
      onError: (error) => {
        setFailure(errorText(error, t));
      },
    });
  };

  return {
    draft,
    failure,
    saving: save.isPending,
    savable: canSave(draft),
    setBucket,
    removeBucket,
    addBucket,
    setChoices,
    preset,
    save: () => {
      write(bucketsPayload(draft), t("buckets.saved"));
    },
    remove: () => {
      write({ buckets: [] }, t("buckets.removed"));
    },
  };
}
