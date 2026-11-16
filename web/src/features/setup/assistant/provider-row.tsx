import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import { errorText } from "@/api/problem";
import { useCheckProviderKey, useDeleteProvider } from "@/features/setup/api";
import type { ModelProvider } from "@/features/setup/api";
import card from "@/features/setup/assistant/assistant-card.module.css";
import { ProviderRowMenu } from "@/features/setup/assistant/provider-row-menu";
import styles from "@/features/setup/assistant/provider-row.module.css";
import { catalogLabel } from "@/features/setup/model/catalog-label";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ProviderRowProps {
  provider: ModelProvider;
  onEdit: () => void;
  onModels: () => void;
}

// One provider (spec A4): its name over its kind and key state, what it does with submitted data
// in words, and its actions. The second line gives way to the outcome of the last key check or
// delete. A provider of the instance has no action: the reader cannot change it.
export function ProviderRow({ provider, onEdit, onModels }: ProviderRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const check = useCheckProviderKey();
  const remove = useDeleteProvider();

  const preset = catalogLabel(
    t,
    `assistant.preset.${provider.preset}`,
    provider.preset,
  );
  const key = t(
    provider.has_key
      ? "assistant.provider.keyStored"
      : "assistant.provider.noKey",
  );
  const kind = `${preset} · ${key}`;
  const failure = check.isError ? check.error : remove.error;
  const outcome = providerOutcome();

  function providerOutcome() {
    if (check.isPending) return t("assistant.key.checking");

    if (check.isSuccess)
      return t("assistant.key.ok", {
        count: numberFormatter(locale).format(check.data),
      });

    return failure === null ? null : errorText(failure, t);
  }

  return (
    <li className={[card.row, styles.row].join(" ")}>
      <div className={card.cell}>
        <Text size="md" weight="medium" truncate>
          {provider.name}
        </Text>
        {outcome !== null && (
          <Text size="sm" tone={failure === null ? "muted" : "danger"} truncate>
            {outcome}
          </Text>
        )}
        {outcome === null && provider.instance && (
          <Text size="sm" tone="muted" truncate>
            {t("assistant.provider.instance")}
          </Text>
        )}
        {outcome === null && !provider.instance && (
          <>
            <Text size="sm" tone="muted" truncate className={card.desk}>
              {kind}
            </Text>
            <Text size="sm" tone="muted" truncate className={card.phone}>
              {preset}
            </Text>
          </>
        )}
      </div>

      <Text
        size="sm"
        tone={provider.notice === "trains" ? "warning" : "muted"}
        truncate
        className={card.desk}
      >
        {t(`assistant.notice.${provider.notice}.row`)}
      </Text>

      <div className={card.actions}>
        {!provider.instance && (
          <>
            <Button
              variant="ghost"
              tone="secondary"
              className={card.desk}
              onClick={onEdit}
            >
              {t("assistant.provider.edit")}
            </Button>

            <ProviderRowMenu
              name={provider.name}
              checking={check.isPending}
              deleting={remove.isPending}
              onEdit={onEdit}
              onCheck={() => {
                check.mutate(provider.id);
              }}
              onModels={onModels}
              onDelete={() => {
                remove.mutate(provider.id);
              }}
            />
          </>
        )}
      </div>
    </li>
  );
}
