import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { ModelProvider } from "@/features/setup/api";
import { AssistantCard } from "@/features/setup/assistant/assistant-card";
import card from "@/features/setup/assistant/assistant-card.module.css";
import { ProviderRow } from "@/features/setup/assistant/provider-row";
import styles from "@/features/setup/assistant/provider-row.module.css";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

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
    <AssistantCard
      title={t("assistant.providers")}
      description={t("assistant.providers.description")}
      actions={
        <Button
          variant="outline"
          tone="secondary"
          disabled={!canAdd}
          onClick={onAdd}
        >
          {t("assistant.provider.add")}
        </Button>
      }
    >
      {providers.length === 0 && (
        <li className={cx(card.row, styles.empty)}>
          <Text size="sm" tone="muted" truncate>
            {t("assistant.providers.empty")}
          </Text>
        </li>
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
    </AssistantCard>
  );
}
