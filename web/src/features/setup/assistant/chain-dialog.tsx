import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useSetUseChain } from "@/features/setup/api";
import type {
  ChainTargetInput,
  ModelPreset,
  ModelProvider,
  ModelUse,
  UsageRow,
} from "@/features/setup/api";
import { ChainAdd } from "@/features/setup/assistant/chain-add";
import styles from "@/features/setup/assistant/chain-dialog.module.css";
import { ChainItem } from "@/features/setup/assistant/chain-item";
import { useChainDraft } from "@/features/setup/assistant/use-chain-draft";
import { catalogLabel } from "@/features/setup/model/catalog-label";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface ChainDialogProps {
  use: ModelUse;
  providers: readonly ModelProvider[];
  presets: readonly ModelPreset[];
  rows: readonly UsageRow[];
  now: Date;
  onClose: () => void;
}

// Orders the models a use tries (spec A9 to A11). A model its preset names takes the preset's
// capabilities; any other takes the ones the reader marks (ADR 019 D5).
export function ChainDialog({
  use,
  providers,
  presets,
  rows,
  now,
  onClose,
}: ChainDialogProps) {
  const t = useT();
  const save = useSetUseChain();
  const draft = useChainDraft(use);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  const own = providers.filter((p) => !p.instance);
  const label = catalogLabel(t, `assistant.use.${use.id}`, use.id);
  const title = t("assistant.chain.title", { use: label });
  const first = t("assistant.chain.first");
  const needs = t("assistant.chain.needs", {
    list: use.needs.map((c) => t(`assistant.capability.${c}`)).join(", "),
  });

  const sends = t(
    use.sends_financial_data ? "assistant.use.sends" : "assistant.use.local",
  );
  const description = `${first} ${needs}. ${sends}.`;

  function providerName(id: string) {
    return (
      providers.find((p) => p.id === id)?.name ??
      use.targets.find((x) => x.provider_id === id)?.provider_name ??
      id
    );
  }

  function send(next: ChainTargetInput[]) {
    setError(null);
    save
      .mutateAsync({ use: use.id, targets: next })
      .then(onClose)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <Dialog open size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            {error !== null && <FormNotice>{error}</FormNotice>}

            <ol className={styles.order} aria-label={title}>
              {draft.targets.length === 0 && (
                <li className={[styles.item, styles.empty].join(" ")}>
                  <Text size="sm" tone="muted" truncate>
                    {t("assistant.chain.empty")}
                  </Text>
                </li>
              )}
              {draft.targets.map((target, index) => (
                <ChainItem
                  key={`${target.provider_id}/${target.model}/${String(index)}`}
                  use={use}
                  target={target}
                  provider={providerName(target.provider_id)}
                  position={index + 1}
                  last={index === draft.targets.length - 1}
                  rows={rows}
                  now={now}
                  onUp={() => {
                    draft.move(index, index - 1);
                  }}
                  onDown={() => {
                    draft.move(index, index + 1);
                  }}
                  onRemove={() => {
                    draft.remove(index);
                  }}
                />
              ))}
            </ol>

            {own.length > 0 && (
              <ChainAdd
                use={use}
                providers={own}
                presets={presets}
                onAdd={draft.add}
              />
            )}
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="ghost"
            tone="secondary"
            disabled={use.default || save.isPending}
            onClick={() => {
              send([]);
            }}
          >
            {t("assistant.chain.restore")}
          </Button>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              send(draft.payload);
            }}
          >
            {t("assistant.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
