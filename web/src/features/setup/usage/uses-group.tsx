import type { ModelUse, UsageRow } from "@/features/setup/api";
import { AssistantCard } from "@/features/setup/assistant/assistant-card";
import { UseRow } from "@/features/setup/usage/use-row";
import { useT } from "@/i18n/i18n-provider";

interface UsesGroupProps {
  uses: readonly ModelUse[];
  rows: readonly UsageRow[];
  now: Date;
  onEdit: (use: ModelUse) => void;
}

// The chain of providers each feature of the assistant runs.
export function UsesGroup({ uses, rows, now, onEdit }: UsesGroupProps) {
  const t = useT();

  return (
    <AssistantCard
      title={t("assistant.uses")}
      description={t("assistant.uses.description")}
    >
      {uses.map((use) => (
        <UseRow
          key={use.id}
          use={use}
          rows={rows}
          now={now}
          onEdit={() => {
            onEdit(use);
          }}
        />
      ))}
    </AssistantCard>
  );
}
