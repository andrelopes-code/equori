import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  presetsQuery,
  providersQuery,
  usageQuery,
  useCheckProviderKey,
  useDeleteProvider,
  usesQuery,
} from "@/features/setup/api";
import type { ModelProvider, ModelUse, UsageRow } from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/catalog-label";
import { ChainDialog } from "@/features/setup/chain-dialog";
import { NoticeTag } from "@/features/setup/notice-tag";
import { ProviderDialog } from "@/features/setup/provider-dialog";
import { ProviderModelsDialog } from "@/features/setup/provider-models-dialog";
import { SettingsSection } from "@/features/setup/settings-section";
import { UsageLimitDialog } from "@/features/setup/usage-limit-dialog";
import { UsageChart } from "@/features/setup/usage-chart";
import { UsePrivacy } from "@/features/setup/use-privacy";
import { UsageList } from "@/features/setup/usage-list";
import { mergeUsageRows } from "@/features/setup/usage-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Open =
  | { kind: "create" }
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
  const remove = useDeleteProvider();
  const check = useCheckProviderKey();
  const [locale] = useAppLocale();
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => {
    setOpen(null);
  };
  const failure = providers.error ?? uses.error ?? usage.error ?? remove.error;
  const presetItems = presets.data?.items ?? [];
  const providerItems = providers.data?.items ?? [];

  return (
    <SettingsSection
      topic="assistant"
      title={t("settings.assistant.title")}
      description={t("settings.assistant.description")}
    >
      <Stack gap={5}>
        {failure !== null && (
          <InlineMessage tone="danger">{errorText(failure, t)}</InlineMessage>
        )}
        {providers.isPending || uses.isPending ? (
          <SkeletonText lines={6} />
        ) : (
          <List variant="ruled" aria-label={t("settings.assistant.title")}>
            <ListSection
              label={t("assistant.providers")}
              end={
                <Button
                  size="sm"
                  variant="outline"
                  tone="secondary"
                  disabled={presetItems.length === 0}
                  onClick={() => {
                    setOpen({ kind: "create" });
                  }}
                >
                  {t("assistant.provider.add")}
                </Button>
              }
            >
              {providerItems.length === 0 && (
                <ListEmpty>{t("assistant.providers.empty")}</ListEmpty>
              )}
              {providerItems.map((provider) => (
                <ListItem key={provider.id}>
                  <ListItemContent>
                    <ListItemBody>
                      <ListItemLabel>{provider.name}</ListItemLabel>
                      <ListItemDescription>
                        {provider.instance
                          ? t("assistant.provider.instance")
                          : `${catalogLabel(t, `assistant.preset.${provider.preset}`, provider.preset)} · ${t(
                              provider.has_key
                                ? "assistant.provider.keyStored"
                                : "assistant.provider.noKey",
                            )}`}
                      </ListItemDescription>
                    </ListItemBody>
                    <ListItemEnd>
                      <NoticeTag notice={provider.notice} />
                    </ListItemEnd>
                  </ListItemContent>
                  {check.variables === provider.id && (
                    <ListItemDescription>
                      {check.isPending && t("assistant.key.checking")}
                      {check.isSuccess &&
                        t("assistant.key.ok", {
                          count: new Intl.NumberFormat(locale).format(
                            check.data,
                          ),
                        })}
                      {check.isError && errorText(check.error, t)}
                    </ListItemDescription>
                  )}
                  {!provider.instance && (
                    <ListItemActions>
                      <Button
                        size="sm"
                        variant="ghost"
                        tone="secondary"
                        loading={
                          check.isPending && check.variables === provider.id
                        }
                        onClick={() => {
                          check.mutate(provider.id);
                        }}
                      >
                        {t("assistant.key.check")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        tone="secondary"
                        onClick={() => {
                          setOpen({ kind: "models", provider });
                        }}
                      >
                        {t("assistant.provider.models")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        tone="secondary"
                        onClick={() => {
                          setOpen({ kind: "edit", provider });
                        }}
                      >
                        {t("assistant.provider.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        tone="danger"
                        loading={
                          remove.isPending && remove.variables === provider.id
                        }
                        onClick={() => {
                          remove.mutate(provider.id);
                        }}
                      >
                        {t("assistant.provider.delete")}
                      </Button>
                    </ListItemActions>
                  )}
                </ListItem>
              ))}
            </ListSection>
            <ListSection label={t("assistant.uses")}>
              {(uses.data?.items ?? []).map((use) => (
                <ListItem key={use.id}>
                  <ListItemContent>
                    <ListItemBody>
                      <ListItemLabel>
                        {catalogLabel(t, `assistant.use.${use.id}`, use.id)}
                      </ListItemLabel>
                      <ListItemDescription>
                        {use.targets.length === 0
                          ? t("assistant.use.none")
                          : use.targets
                              .map((x) => `${x.provider_name} · ${x.model}`)
                              .join(" → ")}
                      </ListItemDescription>
                    </ListItemBody>
                    <ListItemEnd>
                      <Tag
                        size="sm"
                        tone={use.default ? "secondary" : "accent"}
                      >
                        {t(
                          use.default
                            ? "assistant.use.default"
                            : "assistant.use.custom",
                        )}
                      </Tag>
                    </ListItemEnd>
                  </ListItemContent>
                  <UsePrivacy use={use} />
                  <ListItemActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="secondary"
                      onClick={() => {
                        setOpen({ kind: "chain", use });
                      }}
                    >
                      {t("assistant.use.edit")}
                    </Button>
                  </ListItemActions>
                </ListItem>
              ))}
            </ListSection>
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
          </List>
        )}
        <InlineMessage>{t("assistant.usage.note")}</InlineMessage>
      </Stack>
      {(open?.kind === "create" || open?.kind === "edit") && (
        <ProviderDialog
          presets={presetItems}
          provider={open.kind === "edit" ? open.provider : null}
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
