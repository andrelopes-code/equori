import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { CategoryEntry } from "@/features/categories";
import { budgetBucketsQuery } from "@/features/planning/api";
import { BucketDialog } from "@/features/planning/income-split/bucket-dialog";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderAction } from "@/ui/navigation/header-action";

interface IncomeSplitActionProps {
  entries: readonly CategoryEntry[];
}

// The header action that opens the income split from a screen without a plan, such as the
// categories screen.
export function IncomeSplitAction({ entries }: IncomeSplitActionProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const method = useQuery(budgetBucketsQuery(api));
  const [open, setOpen] = useState(false);

  return (
    <>
      <HeaderAction
        label={t("buckets.manage")}
        glyph="pencil"
        wordsOnly
        loading={method.isPending}
        onClick={() => {
          setOpen(true);
        }}
      />
      {open && method.data !== undefined && (
        <BucketDialog
          stored={method.data.buckets}
          entries={entries}
          month={today.slice(0, 7)}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
