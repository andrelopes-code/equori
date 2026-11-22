import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { CheckboxGroup } from "@slotted/react/checkbox-group";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from "@slotted/react/combobox";
import { Field, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupDescription,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { providerModelsQuery } from "@/features/setup/api";
import type {
  ChainTargetInput,
  ModelPreset,
  ModelProvider,
  ModelUse,
} from "@/features/setup/api";
import styles from "@/features/setup/assistant/chain-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type Capability = ModelUse["needs"][number];

interface ChainAddProps {
  use: ModelUse;
  providers: readonly ModelProvider[];
  presets: readonly ModelPreset[];
  onAdd: (target: ChainTargetInput) => void;
}

const capabilities: readonly Capability[] = [
  "tools",
  "structured_output",
  "image_input",
  "web_search",
];

// Adds a target to a chain (spec A10): the provider, a model from the ones the provider's preset
// suggests and the provider lists, or any other text, and what the model offers. A model its
// preset names takes the preset's capabilities on the server (ADR 019 D5).
export function ChainAdd({ use, providers, presets, onAdd }: ChainAddProps) {
  const t = useT();
  const api = useApi();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [model, setModel] = useState("");
  const [marked, setMarked] = useState<readonly string[]>(use.needs);
  const listed = useQuery(providerModelsQuery(api, providerId));

  const preset = providers.find((p) => p.id === providerId)?.preset;
  const suggested = presets.find((p) => p.id === preset)?.models ?? [];
  const models = [
    ...new Set([...suggested.map((m) => m.id), ...(listed.data?.items ?? [])]),
  ];

  function handleAdd() {
    onAdd({
      provider_id: providerId,
      model: model.trim(),
      capabilities: capabilities.filter((c) => marked.includes(c)),
    });
    setModel("");
  }

  return (
    <>
      <div className={styles.add}>
        <Field required>
          <FieldLabel>{t("assistant.chain.provider")}</FieldLabel>
          <ChoiceSelect
            label={t("assistant.chain.provider")}
            multiple={false}
            value={providerId}
            choices={providers.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(value) => {
              if (typeof value === "string") setProviderId(value);
            }}
          />
        </Field>

        <Field required>
          <FieldLabel>{t("assistant.chain.model")}</FieldLabel>
          <Combobox
            allowsCustomValue
            inputValue={model}
            onInputValueChange={setModel}
          >
            <ComboboxInput className={styles.mono} />
            <ComboboxContent>
              {models.map((id) => (
                <ComboboxItem key={id} value={id}>
                  {id}
                </ComboboxItem>
              ))}
            </ComboboxContent>
          </Combobox>
        </Field>

        <Button
          variant="outline"
          tone="secondary"
          disabled={model.trim() === ""}
          onClick={handleAdd}
        >
          {t("assistant.chain.add")}
        </Button>
      </div>

      <FieldGroup necessity="none">
        <FieldGroupLegend>{t("assistant.chain.offers")}</FieldGroupLegend>
        <FieldGroupContent>
          <CheckboxGroup
            orientation="horizontal"
            size="sm"
            value={marked}
            onValueChange={setMarked}
          >
            {capabilities.map((c) => (
              <Checkbox key={c} value={c}>
                {t(`assistant.capability.${c}`)}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </FieldGroupContent>

        {marked.includes("web_search") && (
          <FieldGroupDescription>
            {t("assistant.capability.web_search.hint")}
          </FieldGroupDescription>
        )}
      </FieldGroup>
    </>
  );
}
