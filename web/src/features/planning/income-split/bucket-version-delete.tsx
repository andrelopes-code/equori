import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteBudgetBucketVersion } from "@/features/planning/api";
import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type Version = components["schemas"]["BudgetBucketVersion"];

interface BucketVersionDeleteProps {
  versions: readonly Version[];
  // The start of the version to delete.
  from: string;
  onKeep: () => void;
}

// What deleting a version does to its months, asked once before it happens.
export function BucketVersionDelete({
  versions,
  from,
  onKeep,
}: BucketVersionDeleteProps) {
  const t = useT();
  const names = useMonthNames([]);
  const remove = useDeleteBudgetBucketVersion();

  const index = versions.findIndex((v) => v.from === from);
  const others = versions.filter((v) => v.from !== from);
  const before = versions[index - 1];
  const onlyOne =
    (versions[index]?.buckets.length ?? 0) > 0 &&
    others.every((v) => v.buckets.length === 0);
  const key = confirmKey(onlyOne, before !== undefined);
  const message = t(key, { month: names.longYear(before?.from ?? from) });

  function handleDelete() {
    remove.mutate(from, {
      onSuccess: () => {
        toast.show({ tone: "success", title: t("buckets.version.deleted") });
        onKeep();
      },
      onError: (error) => {
        toast.show({ tone: "danger", title: errorText(error, t) });
      },
    });
  }

  return (
    <Alert tone="danger">
      <AlertContent>
        <AlertDescription>{message}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button loading={remove.isPending} onClick={handleDelete}>
          {t("buckets.version.delete")}
        </Button>
        <Button variant="ghost" onClick={onKeep}>
          {t("buckets.version.keep")}
        </Button>
      </AlertActions>
    </Alert>
  );
}

function confirmKey(onlyOne: boolean, hasBefore: boolean): MessageKey {
  if (onlyOne) return "buckets.version.deleteConfirmOnly";
  return hasBefore
    ? "buckets.version.deleteConfirm"
    : "buckets.version.deleteConfirmStart";
}
