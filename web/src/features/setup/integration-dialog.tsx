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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import {
  useCreateIntegration,
  useUpdateIntegrationCredentials,
} from "@/features/setup/api";
import type { Aggregator, Integration } from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/catalog-label";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormLayout } from "@/ui/form-layout";
import { useStableCallback } from "@/ui/use-stable-callback";

// Creates an integration, or replaces the credentials of one. The fields come from the
// aggregator's `credential_fields`; a secret field is write-only and starts empty. The
// aggregator validates the credentials first, so a refusal leaves the stored ones as they were.
export function IntegrationDialog({
  aggregators,
  integration,
  onClose,
}: {
  aggregators: readonly Aggregator[];
  integration: Integration | null;
  onClose: () => void;
}) {
  const t = useT();
  const formId = useId();
  const create = useCreateIntegration();
  const rotate = useUpdateIntegrationCredentials();
  const [aggregatorId, setAggregatorId] = useState<string | null>(
    integration?.aggregator ?? aggregators[0]?.id ?? null,
  );
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const aggregator = aggregators.find((a) => a.id === aggregatorId);
  const pending = create.isPending || rotate.isPending;
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  const ready =
    aggregator !== undefined &&
    (integration !== null || name.trim() !== "") &&
    aggregator.credential_fields.every((f) => (values[f.name] ?? "") !== "");

  const fail = (caught: unknown) => {
    setSummary(errorText(caught, t));
    setErrors(
      caught instanceof ProblemError ? fieldErrors(caught.problem) : {},
    );
  };
  const submit = () => {
    if (aggregator === undefined) return;
    setSummary(null);
    setErrors({});
    const credentials = Object.fromEntries(
      aggregator.credential_fields.map((f) => [f.name, values[f.name] ?? ""]),
    );
    const done =
      integration === null
        ? create.mutateAsync({
            aggregator: aggregator.id,
            name: name.trim(),
            credentials,
          })
        : rotate.mutateAsync({ id: integration.id, credentials });
    done.then(onClose).catch(fail);
  };

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {integration === null
              ? t("settings.integrations.add")
              : t("settings.integrations.rotateTitle", {
                  name: integration.name,
                })}
          </DialogTitle>
          <DialogDescription>
            {t("settings.integrations.secretHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}

              {integration === null && (
                <>
                  <Field required>
                    <FieldLabel>
                      {t("settings.integrations.aggregator")}
                    </FieldLabel>
                    <ChoiceSelect
                      label={t("settings.integrations.aggregator")}
                      multiple={false}
                      value={aggregatorId}
                      choices={aggregators.map((a) => ({
                        value: a.id,
                        label: a.name,
                      }))}
                      onChange={(next) => {
                        setAggregatorId(typeof next === "string" ? next : null);
                        setValues({});
                      }}
                    />
                  </Field>

                  <Field invalid={errors.name !== undefined} required>
                    <FieldLabel>{t("settings.integrations.name")}</FieldLabel>
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
                </>
              )}

              {aggregator?.credential_fields.map((field) => {
                const error = errors[`credentials.${field.name}`];
                return (
                  <Field
                    key={field.name}
                    invalid={error !== undefined}
                    required
                  >
                    <FieldLabel>
                      {catalogLabel(
                        t,
                        `settings.integrations.field.${field.name}`,
                        field.name,
                      )}
                    </FieldLabel>
                    <TextField
                      name={field.name}
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={200}
                      value={values[field.name] ?? ""}
                      onChange={(event) => {
                        setValues((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }));
                      }}
                    />
                    {error !== undefined && <FieldError>{error}</FieldError>}
                    {field.secret && (
                      <FieldDescription>
                        {t("settings.integrations.secretHint")}
                      </FieldDescription>
                    )}
                  </Field>
                );
              })}
            </FormLayout>
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
            disabled={!ready}
          >
            {t(
              integration === null
                ? "settings.integrations.create"
                : "detail.save",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
