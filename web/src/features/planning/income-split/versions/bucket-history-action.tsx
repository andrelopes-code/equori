import { Button } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { budgetBucketVersionsQuery } from "@/features/planning/api";
import { BucketDialog } from "@/features/planning/income-split/bucket-dialog";
import { BucketVersionsDialog } from "@/features/planning/income-split/versions/bucket-versions-dialog";
import { useT } from "@/i18n/i18n-provider";

type Version = components["schemas"]["BudgetBucketVersion"];

interface BucketHistoryActionProps {
  // The month on screen.
  month: string;
  entries: readonly CategoryEntry[];
}

// The History button of the split section, the versions dialog it opens and the edit dialog
// of one version. Draws nothing while the book has no version.
export function BucketHistoryAction({
  month,
  entries,
}: BucketHistoryActionProps) {
  const t = useT();
  const api = useApi();
  const versions = useQuery(budgetBucketVersionsQuery(api));
  const [listing, setListing] = useState(false);
  const [editing, setEditing] = useState<Version | null>(null);

  if ((versions.data?.versions.length ?? 0) === 0) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        onClick={() => {
          setListing(true);
        }}
      >
        {t("buckets.history")}
      </Button>
      {listing && editing === null && (
        <BucketVersionsDialog
          versions={versions.data?.versions ?? []}
          month={month}
          categories={entries}
          onEdit={setEditing}
          onClose={() => {
            setListing(false);
          }}
        />
      )}
      {editing !== null && (
        <BucketDialog
          stored={editing.buckets}
          entries={entries}
          month={editing.from}
          from={editing.from}
          onClose={() => {
            setEditing(null);
            setListing(false);
          }}
        />
      )}
    </>
  );
}
