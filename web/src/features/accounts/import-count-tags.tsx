import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";

import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type ImportCounts = components["schemas"]["ImportCounts"];

const shown: {
  key: keyof ImportCounts;
  label: MessageKey;
  tone: "secondary" | "success" | "warning";
}[] = [
  { key: "created", label: "imports.count.created", tone: "secondary" },
  { key: "matched", label: "imports.count.matched", tone: "success" },
  { key: "needs_review", label: "imports.count.needs_review", tone: "warning" },
  { key: "updated", label: "imports.count.updated", tone: "secondary" },
  { key: "withdrawn", label: "imports.count.withdrawn", tone: "secondary" },
];

// What a batch did with its lines, one mark per outcome that happened.
export function ImportCountTags({ counts }: { counts: ImportCounts }) {
  const t = useT();
  return (
    <Inline gap={2}>
      {shown
        .filter((entry) => counts[entry.key] > 0)
        .map((entry) => (
          <Tag key={entry.key} size="sm" tone={entry.tone}>
            {t(entry.label, { count: counts[entry.key] })}
          </Tag>
        ))}
    </Inline>
  );
}
