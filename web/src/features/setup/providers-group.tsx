import { Button } from "@slotted/react/button";
import { List, ListEmpty } from "@slotted/react/list";

import type { ModelProvider } from "@/features/setup/api";
import { ProviderRow } from "@/features/setup/provider-row";
import { SettingsGroup } from "@/features/setup/settings-group";
import { useT } from "@/i18n/i18n-provider";

interface ProvidersGroupProps {
  providers: readonly ModelProvider[];
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (provider: ModelProvider) => void;
  onModels: (provider: ModelProvider) => void;
}

// The providers the reader can call, with the button that adds one beside the title.
export function ProvidersGroup({
  providers,
  canAdd,
  onAdd,
  onEdit,
  onModels,
}: ProvidersGroupProps) {
  const t = useT();

  return (
    <SettingsGroup
      title={t("assistant.providers")}
      description={t("assistant.providers.description")}
      actions={
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          disabled={!canAdd}
          onClick={onAdd}
        >
          {t("assistant.provider.add")}
        </Button>
      }
    >
      <List variant="ruled" aria-label={t("assistant.providers")}>
        {providers.length === 0 && (
          <ListEmpty>{t("assistant.providers.empty")}</ListEmpty>
        )}
        {providers.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            onEdit={() => {
              onEdit(provider);
            }}
            onModels={() => {
              onModels(provider);
            }}
          />
        ))}
      </List>
    </SettingsGroup>
  );
}
