import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useSetUseChain } from "@/features/setup/api";
import type {
  ChainTargetInput,
  ModelPreset,
  ModelProvider,
  ModelUse,
} from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/catalog-label";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { useStableCallback } from "@/ui/use-stable-callback";

type Capability = ModelUse["needs"][number];
const capabilities: readonly Capability[] = [
  "tools",
  "structured_output",
  "image_input",
];

// Orders the models a use tries. A model its preset names takes the preset's capabilities;
// any other takes the ones the reader marks (ADR 019 D5).
export function ChainDialog({
  use,
  providers,
  presets,
  onClose,
}: {
  use: ModelUse;
  providers: readonly ModelProvider[];
  presets: readonly ModelPreset[];
  onClose: () => void;
}) {
  const t = useT();
  const save = useSetUseChain();
  const own = providers.filter((p) => !p.instance);
  const [targets, setTargets] = useState<ChainTargetInput[]>(() =>
    use.default
      ? []
      : use.targets.map((target) => ({
          provider_id: target.provider_id,
          model: target.model,
          capabilities: target.capabilities,
        })),
  );
  const [providerId, setProviderId] = useState<string | null>(
    own[0]?.id ?? null,
  );
  const [model, setModel] = useState("");
  const [marked, setMarked] = useState<string[]>([...use.needs]);
  const [error, setError] = useState<string | null>(null);
  const label = catalogLabel(t, `assistant.use.${use.id}`, use.id);
  const capabilityLabel = (c: Capability) => t(`assistant.capability.${c}`);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  const providerName = (id: string) => own.find((p) => p.id === id)?.name ?? id;
  const presetModels = presets.find(
    (p) => p.id === own.find((o) => o.id === providerId)?.preset,
  )?.models;
  const send = (next: ChainTargetInput[]) => {
    setError(null);
    save
      .mutateAsync({ use: use.id, targets: next })
      .then(onClose)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  };
  const move = (from: number, to: number) => {
    setTargets((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (item !== undefined) next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <Dialog open size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("assistant.chain.title", { use: label })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
            <InlineMessage>
              {t("assistant.chain.needs", {
                list: use.needs.map(capabilityLabel).join(", "),
              })}
            </InlineMessage>
            <List
              variant="framed"
              size="sm"
              aria-label={t("assistant.chain.title", { use: label })}
            >
              {targets.length === 0 && (
                <ListEmpty>{t("assistant.chain.empty")}</ListEmpty>
              )}
              {targets.map((target, index) => (
                <ListItem
                  key={`${target.provider_id}/${target.model}/${String(index)}`}
                >
                  <ListItemContent>
                    <ListItemBody>
                      <ListItemLabel>{target.model}</ListItemLabel>
                      <ListItemDescription>
                        {providerName(target.provider_id)}
                      </ListItemDescription>
                    </ListItemBody>
                  </ListItemContent>
                  <ListItemActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="secondary"
                      disabled={index === 0}
                      onClick={() => {
                        move(index, index - 1);
                      }}
                    >
                      {t("assistant.chain.up")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="secondary"
                      disabled={index === targets.length - 1}
                      onClick={() => {
                        move(index, index + 1);
                      }}
                    >
                      {t("assistant.chain.down")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="danger"
                      onClick={() => {
                        setTargets((current) =>
                          current.filter((_, i) => i !== index),
                        );
                      }}
                    >
                      {t("assistant.chain.remove")}
                    </Button>
                  </ListItemActions>
                </ListItem>
              ))}
            </List>
            {own.length > 0 && (
              <Stack gap={3}>
                <Inline gap={3} align="end">
                  <Field>
                    <FieldLabel>{t("assistant.chain.provider")}</FieldLabel>
                    <ChoiceSelect
                      label={t("assistant.chain.provider")}
                      multiple={false}
                      value={providerId}
                      choices={own.map((p) => ({ value: p.id, label: p.name }))}
                      onChange={(value) => {
                        if (typeof value === "string") setProviderId(value);
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("assistant.chain.model")}</FieldLabel>
                    <TextField
                      value={model}
                      list={`models-${use.id}`}
                      onChange={(event) => {
                        setModel(event.target.value);
                      }}
                    />
                    <datalist id={`models-${use.id}`}>
                      {presetModels?.map((m) => (
                        <option key={m.id} value={m.id} />
                      ))}
                    </datalist>
                  </Field>
                </Inline>
                <Field>
                  <FieldLabel>{t("assistant.chain.capabilities")}</FieldLabel>
                  <ChoiceSelect
                    label={t("assistant.chain.capabilities")}
                    multiple
                    value={marked}
                    choices={capabilities.map((c) => ({
                      value: c,
                      label: capabilityLabel(c),
                    }))}
                    onChange={(value) => {
                      setMarked(Array.isArray(value) ? value : []);
                    }}
                  />
                </Field>
                <Inline>
                  <Button
                    variant="outline"
                    tone="secondary"
                    disabled={providerId === null || model.trim() === ""}
                    onClick={() => {
                      if (providerId === null) return;
                      setTargets((current) => [
                        ...current,
                        {
                          provider_id: providerId,
                          model: model.trim(),
                          capabilities: marked as Capability[],
                        },
                      ]);
                      setModel("");
                    }}
                  >
                    {t("assistant.chain.add")}
                  </Button>
                </Inline>
              </Stack>
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
              send(targets);
            }}
          >
            {t("assistant.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
