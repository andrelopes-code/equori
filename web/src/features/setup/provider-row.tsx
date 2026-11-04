import { Button } from "@slotted/react/button";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";

import { errorText } from "@/api/problem";
import { useCheckProviderKey, useDeleteProvider } from "@/features/setup/api";
import type { ModelProvider } from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/catalog-label";
import { NoticeTag } from "@/features/setup/notice-tag";
import { ProviderRowMenu } from "@/features/setup/provider-row-menu";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ProviderRowProps {
  provider: ModelProvider;
  onEdit: () => void;
  onModels: () => void;
}

// One provider: its name and notice, what kind and whether a key is stored, and the outcome of the
// last key check or delete. A provider of the instance has no action: the reader cannot change it.
export function ProviderRow({ provider, onEdit, onModels }: ProviderRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const check = useCheckProviderKey();
  const remove = useDeleteProvider();
  const kind = provider.instance
    ? t("assistant.provider.instance")
    : [
        catalogLabel(t, `assistant.preset.${provider.preset}`, provider.preset),
        t(
          provider.has_key
            ? "assistant.provider.keyStored"
            : "assistant.provider.noKey",
        ),
      ].join(" · ");
  const outcome = check.isError ? check.error : remove.error;

  return (
    <ListItem>
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>{provider.name}</ListItemLabel>
          <ListItemDescription>{kind}</ListItemDescription>
          {check.isPending && (
            <ListItemDescription>
              {t("assistant.key.checking")}
            </ListItemDescription>
          )}
          {check.isSuccess && (
            <ListItemDescription>
              {t("assistant.key.ok", {
                count: numberFormatter(locale).format(check.data),
              })}
            </ListItemDescription>
          )}
          {outcome !== null && (
            <ListItemDescription>{errorText(outcome, t)}</ListItemDescription>
          )}
        </ListItemBody>
        <ListItemEnd>
          <NoticeTag notice={provider.notice} />
        </ListItemEnd>
      </ListItemContent>
      {!provider.instance && (
        <ListItemActions>
          <Button size="sm" variant="ghost" tone="secondary" onClick={onEdit}>
            {t("assistant.provider.edit")}
          </Button>
          <ProviderRowMenu
            name={provider.name}
            checking={check.isPending}
            deleting={remove.isPending}
            onCheck={() => {
              check.mutate(provider.id);
            }}
            onModels={onModels}
            onDelete={() => {
              remove.mutate(provider.id);
            }}
          />
        </ListItemActions>
      )}
    </ListItem>
  );
}
