import { Text } from "@slotted/react/typography";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
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
import { AssistantStart } from "@/features/setup/assistant-start";
import type { StartPreset } from "@/features/setup/assistant-start";
import { ChainDialog } from "@/features/setup/chain-dialog";
import { ProviderDialog } from "@/features/setup/provider-dialog";
import { ProviderModelsDialog } from "@/features/setup/provider-models-dialog";
import { ProvidersGroup } from "@/features/setup/providers-group";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { UsageLimitDialog } from "@/features/setup/usage-limit-dialog";
import { UsageChart } from "@/features/setup/usage-chart";
import { UsageList } from "@/features/setup/usage-list";
import { UsesGroup } from "@/features/setup/uses-group";
import { mergeUsageRows } from "@/features/setup/usage-rows";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

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
  // S2: open while the reader set more than the default state; it follows data that arrives later.
  const advancedOpen =
    providerItems.filter((p) => !p.instance).length > 1 ||
    (uses.data?.items ?? []).some((use) => !use.default);
  // The providers whose free tier trains on what a use sends, when that use sends financial data.
  const training = [
    ...new Set(
      (uses.data?.items ?? [])
        .filter((use) => use.sends_financial_data)
        .flatMap((use) => use.targets)
        .filter((target) => target.notice === "trains")
        .map((target) => target.provider_name),
    ),
  ];

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
      {training.length > 0 && (
        <Alert tone="warning">
          <AlertContent>
            <AlertDescription>
              {t("assistant.use.trains", { provider: training.join(", ") })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {providers.isPending || uses.isPending ? (
        <SettingsGroup>
          <SkeletonText lines={6} />
        </SettingsGroup>
      ) : (
        <>
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
          {/* S2: closed while the reader keeps one provider and the default chains. */}
          <Collapsible
            mount="active"
            key={String(advancedOpen)}
            defaultOpen={advancedOpen}
          >
            <CollapsibleHeader>
              <CollapsibleTrigger>{t("assistant.advanced")}</CollapsibleTrigger>
            </CollapsibleHeader>
            <CollapsiblePanel>
              <Stack gap={7}>
                <UsesGroup
                  uses={uses.data?.items ?? []}
                  onEdit={(use) => {
                    setOpen({ kind: "chain", use });
                  }}
                />
                <UsageList
                  rows={mergeUsageRows(
                    usage.data?.items ?? [],
                    uses.data?.items ?? [],
                    new Set(
                      providerItems.filter((p) => p.instance).map((p) => p.id),
                    ),
                  )}
                  now={new Date(usage.dataUpdatedAt)}
                  onLimits={(row) => {
                    setOpen({ kind: "limits", row });
                  }}
                />
                <UsageChart />
              </Stack>
            </CollapsiblePanel>
          </Collapsible>
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
          onClose={close}
        />
      )}
    </SettingsSection>
  );
}
