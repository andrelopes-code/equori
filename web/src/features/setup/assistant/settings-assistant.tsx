import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { chatStateQuery } from "@/features/assistant";
import { errorText } from "@/api/problem";
import {
  presetsQuery,
  providersQuery,
  usageQuery,
  usesQuery,
} from "@/features/setup/api";
import type { ModelProvider, ModelUse, UsageRow } from "@/features/setup/api";
import { AssistantLoading } from "@/features/setup/assistant/assistant-loading";
import { AssistantStart } from "@/features/setup/assistant/assistant-start";
import type { StartPreset } from "@/features/setup/assistant/assistant-start";
import { AssistantStatus } from "@/features/setup/assistant/assistant-status";
import { ChainDialog } from "@/features/setup/assistant/chain-dialog";
import { ProviderDialog } from "@/features/setup/assistant/provider-dialog";
import { ProviderModelsDialog } from "@/features/setup/assistant/provider-models-dialog";
import { ProvidersGroup } from "@/features/setup/assistant/providers-group";
import { SettingsSection } from "@/features/setup/settings-layout/settings-section";
import { UsageLimitDialog } from "@/features/setup/usage/usage-limit-dialog";
import { UsageList } from "@/features/setup/usage/usage-list";
import { UsesGroup } from "@/features/setup/usage/uses-group";
import { mergeUsageRows } from "@/features/setup/usage/usage-rows";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

type Open =
  | { kind: "create"; preset?: StartPreset }
  | { kind: "edit"; provider: ModelProvider }
  | { kind: "models"; provider: ModelProvider }
  | { kind: "chain"; use: ModelUse }
  | { kind: "limits"; row: UsageRow };

// Language model providers of the user and the chain of each use (ADR 019).
export function SettingsAssistant() {
  const t = useT();
  const api = useApi();
  const presets = useQuery(presetsQuery(api));
  const providers = useQuery(providersQuery(api));
  const uses = useQuery(usesQuery(api));
  const usage = useQuery(usageQuery(api));
  const chat = useQuery(chatStateQuery(api));
  const navigate = useNavigate();
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => {
    setOpen(null);
  };
  const failure = providers.error ?? uses.error ?? usage.error ?? chat.error;
  const presetItems = presets.data?.items ?? [];
  const providerItems = providers.data?.items ?? [];
  // S1: no provider of the reader's own and none of the instance serving the chat.
  const starting =
    providers.data !== undefined &&
    chat.data?.available === false &&
    // A limit (retry_at) means a provider serves the reader and is resting.
    chat.data.retry_at === undefined &&
    providerItems.every((p) => p.instance);
  const useItems = uses.data?.items ?? [];
  const loading = providers.isPending || uses.isPending;
  const now = new Date(usage.dataUpdatedAt);
  // A zero row per chain target not used yet, so a limit can be declared before the first call.
  const rows = mergeUsageRows(
    usage.data?.items ?? [],
    useItems,
    new Set(providerItems.filter((p) => p.instance).map((p) => p.id)),
  );

  return (
    <SettingsSection
      topic="assistant"
      title={t("settings.assistant.title")}
      description={t("settings.assistant.description")}
    >
      {failure !== null && <FormNotice>{errorText(failure, t)}</FormNotice>}
      {starting && (
        <AssistantStart
          onPreset={(preset) => {
            setOpen({ kind: "create", preset });
          }}
          onExternal={() => {
            void navigate({
              to: "/settings",
              search: { section: "external_access" },
            });
          }}
        />
      )}
      {loading && <AssistantLoading />}
      {!loading && (
        <>
          {!starting && (
            <AssistantStatus uses={useItems} rows={rows} now={now} />
          )}

          <ProvidersGroup
            providers={providerItems}
            canAdd={presetItems.length > 0}
            onAdd={() => {
              setOpen({ kind: "create" });
            }}
            onEdit={(provider) => {
              setOpen({ kind: "edit", provider });
            }}
            onModels={(provider) => {
              setOpen({ kind: "models", provider });
            }}
          />

          <UsesGroup
            uses={useItems}
            rows={rows}
            now={now}
            onEdit={(use) => {
              setOpen({ kind: "chain", use });
            }}
          />

          <UsageList
            rows={rows}
            now={now}
            onLimits={(row) => {
              setOpen({ kind: "limits", row });
            }}
          />
        </>
      )}
      <Text size="sm" tone="muted">
        {t("assistant.usage.note")}
      </Text>
      {(open?.kind === "create" || open?.kind === "edit") && (
        <ProviderDialog
          presets={presetItems}
          provider={open.kind === "edit" ? open.provider : null}
          initialPreset={open.kind === "create" ? open.preset : undefined}
          onClose={close}
        />
      )}
      {open?.kind === "models" && (
        <ProviderModelsDialog provider={open.provider} onClose={close} />
      )}
      {open?.kind === "limits" && (
        <UsageLimitDialog row={open.row} onClose={close} />
      )}
      {open?.kind === "chain" && (
        <ChainDialog
          use={open.use}
          providers={providerItems}
          presets={presetItems}
          rows={rows}
          now={now}
          onClose={close}
        />
      )}
    </SettingsSection>
  );
}
