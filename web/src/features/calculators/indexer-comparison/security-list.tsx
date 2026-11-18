import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";

import type { Security } from "@/features/calculators/indexer-comparison/security";
import { SecurityFields } from "@/features/calculators/indexer-comparison/security-fields";
import type { useComparisonDraft } from "@/features/calculators/indexer-comparison/use-comparison-draft";
import { useT } from "@/i18n/i18n-provider";

interface SecurityListProps {
  draft: ReturnType<typeof useComparisonDraft>;
  // The securities of the draft rows, resolved, in order.
  securities: readonly Security[];
  offered: readonly { id: string; period: "day" | "month" }[];
}

// The rows of securities and the button that adds one, up to six; the first two stay.
export function SecurityList({
  draft,
  securities,
  offered,
}: SecurityListProps) {
  const t = useT();

  return (
    <Stack gap={3}>
      {draft.rows.map((row, i) => (
        <SecurityFields
          key={row.key}
          position={i + 1}
          draft={row}
          security={securities[i] ?? { form: "fixed", rate: null, taxed: true }}
          offered={offered}
          removable={i >= 2}
          onChange={(patch) => {
            draft.change(row.key, patch);
          }}
          onRemove={() => {
            draft.remove(row.key);
          }}
        />
      ))}

      {draft.canAdd && (
        <Button variant="outline" size="sm" onClick={draft.add}>
          {t("calc.indexerComparison.add")}
        </Button>
      )}
    </Stack>
  );
}
