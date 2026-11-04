import { List } from "@slotted/react/list";

import type { ModelUse } from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { UseRow } from "@/features/setup/use-row";
import { useT } from "@/i18n/i18n-provider";

interface UsesGroupProps {
  uses: readonly ModelUse[];
  onEdit: (use: ModelUse) => void;
}

// The chain of providers each feature of the assistant runs.
export function UsesGroup({ uses, onEdit }: UsesGroupProps) {
  const t = useT();

  return (
    <SettingsGroup
      title={t("assistant.uses")}
      description={t("assistant.uses.description")}
    >
      <List variant="ruled" aria-label={t("assistant.uses")}>
        {uses.map((use) => (
          <UseRow
            key={use.id}
            use={use}
            onEdit={() => {
              onEdit(use);
            }}
          />
        ))}
      </List>
    </SettingsGroup>
  );
}
