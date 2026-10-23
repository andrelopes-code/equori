import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useCreateProvider, useUpdateProvider } from "@/features/setup/api";
import type { ModelPreset, ModelProvider } from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/catalog-label";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { useStableCallback } from "@/ui/use-stable-callback";

// Creates a provider from a preset, or edits one; an edit sends only the fields the reader
// changed (FM-09), and an empty key keeps the stored one.
export function ProviderDialog({
  presets,
  provider,
  onClose,
}: {
  presets: readonly ModelPreset[];
  provider: ModelProvider | null;
  onClose: () => void;
}) {
  const t = useT();
  const formId = useId();
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const [presetId, setPresetId] = useState(
    provider?.preset ?? presets[0]?.id ?? "",
  );
  const [name, setName] = useState(provider?.name ?? "");
  const [baseURL, setBaseURL] = useState(provider?.base_url ?? "");
  const [key, setKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const preset = presets.find((p) => p.id === presetId);
  const pending = create.isPending || update.isPending;
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  const fail = (caught: unknown) => {
    setSummary(errorText(caught, t));
    setErrors(
      caught instanceof ProblemError ? fieldErrors(caught.problem) : {},
    );
  };
  const submit = () => {
    setSummary(null);
    setErrors({});
    if (provider === null) {
      create
        .mutateAsync({
          preset: presetId,
          name: name.trim(),
          ...(baseURL.trim() === "" ? {} : { base_url: baseURL.trim() }),
          ...(key === "" ? {} : { key }),
        })
        .then(onClose)
        .catch(fail);
      return;
    }
    update
      .mutateAsync({
        id: provider.id,
        body: {
          ...(name.trim() === provider.name ? {} : { name: name.trim() }),
          ...(baseURL.trim() === provider.base_url
            ? {}
            : { base_url: baseURL.trim() }),
          ...(key === "" ? {} : { key }),
        },
      })
      .then(onClose)
      .catch(fail);
  };

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              provider === null
                ? "assistant.provider.add"
                : "assistant.provider.edit",
            )}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Stack gap={4}>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}
              {provider === null && (
                <Field invalid={errors.preset !== undefined} required>
                  <FieldLabel>{t("assistant.field.preset")}</FieldLabel>
                  <ChoiceSelect
                    label={t("assistant.field.preset")}
                    multiple={false}
                    value={presetId}
                    choices={presets.map((p) => ({
                      value: p.id,
                      label: catalogLabel(t, `assistant.preset.${p.id}`, p.id),
                    }))}
                    onChange={(value) => {
                      if (typeof value === "string") setPresetId(value);
                    }}
                  />
                  {errors.preset !== undefined && (
                    <FieldError>{errors.preset}</FieldError>
                  )}
                </Field>
              )}
              {preset !== undefined && (
                <InlineMessage
                  tone={preset.notice === "trains" ? "warning" : "secondary"}
                >
                  {t(`assistant.notice.${preset.notice}.detail`)}
                </InlineMessage>
              )}
              <Field invalid={errors.name !== undefined} required>
                <FieldLabel>{t("assistant.field.name")}</FieldLabel>
                <TextField
                  name="name"
                  value={name}
                  maxLength={60}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                {errors.name !== undefined && (
                  <FieldError>{errors.name}</FieldError>
                )}
              </Field>
              <Field
                invalid={errors.base_url !== undefined}
                required={preset?.base_url === ""}
              >
                <FieldLabel>{t("assistant.field.baseUrl")}</FieldLabel>
                <TextField
                  name="base_url"
                  type="url"
                  value={baseURL}
                  placeholder={preset?.base_url}
                  onChange={(event) => {
                    setBaseURL(event.target.value);
                  }}
                />
                {preset !== undefined && preset.base_url !== "" && (
                  <FieldDescription>
                    {t("assistant.field.baseUrl.hint", {
                      url: preset.base_url,
                    })}
                  </FieldDescription>
                )}
                {errors.base_url !== undefined && (
                  <FieldError>{errors.base_url}</FieldError>
                )}
              </Field>
              <Field
                invalid={errors.key !== undefined}
                required={provider === null && preset?.key_required === true}
              >
                <FieldLabel>{t("assistant.field.key")}</FieldLabel>
                <TextField
                  name="key"
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(event) => {
                    setKey(event.target.value);
                  }}
                />
                {provider !== null && provider.has_key && (
                  <FieldDescription>
                    {t("assistant.field.key.keep")}
                  </FieldDescription>
                )}
                {preset?.key_required === false && (
                  <FieldDescription>
                    {t("assistant.field.key.optional")}
                  </FieldDescription>
                )}
                {errors.key !== undefined && (
                  <FieldError>{errors.key}</FieldError>
                )}
              </Field>
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={pending}
            disabled={name.trim() === ""}
          >
            {t(provider === null ? "assistant.create" : "assistant.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
