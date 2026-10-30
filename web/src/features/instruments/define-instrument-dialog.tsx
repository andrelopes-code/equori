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
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { subtypesQuery, useDefineInstrument } from "@/features/instruments/api";
import { instrumentTypes } from "@/features/instruments/instrument-groups";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/instrument-labels";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type InstrumentType = components["schemas"]["InstrumentType"];

// Stands for "no subtype" in the select; a subtype matches ^[a-z0-9_]{2,40}$, so it never collides.
const none = "-";

// Defines a security or currency for the whole instance. The subtype choices come from the
// jurisdiction through listInstrumentSubtypes for the chosen type; a type without subtypes hides
// the field.
export function DefineInstrumentDialog({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const api = useApi();
  const formId = useId();
  const overlayOpen = useOverlayOpen();
  const define = useDefineInstrument();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const instruments = useQuery(instrumentsQuery(api));
  const [code, setCode] = useState("");
  const [type, setType] = useState<InstrumentType | null>(null);
  const [scale, setScale] = useState("");
  const [name, setName] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [exchange, setExchange] = useState("");
  const [subtype, setSubtype] = useState(none);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const subtypes = useQuery({
    ...subtypesQuery(api, type ?? "stock"),
    enabled: type !== null,
  });
  const subtypeChoices = useMemo(
    () => [
      { value: none, label: t("instruments.subtype.none") },
      ...(subtypes.data ?? []).map((s) => ({
        value: s,
        label: subtypeLabel(t, s),
      })),
    ],
    [subtypes.data, t],
  );
  const typeChoices = useMemo(
    () => instrumentTypes.map((v) => ({ value: v, label: typeLabel(t, v) })),
    [t],
  );
  const currencyChoices = useMemo(
    () =>
      (instruments.data?.items ?? [])
        .filter((i) => i.type === "currency")
        .map((i) => ({ value: i.code, label: `${i.code} ${i.name}` })),
    [instruments.data],
  );
  const chosenQuote = quote ?? base ?? null;
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const submit = () => {
    const next: Record<string, string> = {};
    const required = t("instruments.required");
    if (code.trim() === "") next.code = required;
    if (type === null) next.type = required;
    if (scale.trim() === "") next.scale = required;
    if (name.trim() === "") next.name = required;
    if (chosenQuote === null) next.quote_currency = required;
    setErrors(next);
    setSummary(null);
    if (Object.keys(next).length > 0 || type === null || chosenQuote === null)
      return;
    define
      .mutateAsync({
        code: code.trim().toUpperCase(),
        type,
        scale: Number(scale),
        name: name.trim(),
        quote_currency: chosenQuote,
        ...(exchange.trim() === "" ? {} : { exchange: exchange.trim() }),
        ...(subtype === none ? {} : { subtype }),
      })
      .then(onDone)
      .catch((caught: unknown) => {
        const fields =
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {};
        setErrors(fields);
        setSummary(
          Object.keys(fields).length > 0 ? null : errorText(caught, t),
        );
      });
  };
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("instruments.define")}</DialogTitle>
          <DialogDescription>
            {t("instruments.define.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}

              <FormRow>
                <Field invalid={errors.type !== undefined} required>
                  <FieldLabel>{t("instruments.field.type")}</FieldLabel>
                  <ChoiceSelect
                    label={t("instruments.field.type")}
                    choices={typeChoices}
                    value={type}
                    multiple={false}
                    invalid={errors.type !== undefined}
                    onChange={(next) => {
                      if (typeof next !== "string") return;
                      setType(next as InstrumentType);
                      setSubtype(none);
                    }}
                  />
                  {errors.type !== undefined && (
                    <FieldError>{errors.type}</FieldError>
                  )}
                </Field>

                {subtypeChoices.length > 1 && (
                  <Field invalid={errors.subtype !== undefined}>
                    <FieldLabel>{t("instruments.field.subtype")}</FieldLabel>
                    <ChoiceSelect
                      label={t("instruments.field.subtype")}
                      choices={subtypeChoices}
                      value={subtype}
                      multiple={false}
                      onChange={(next) => {
                        if (typeof next === "string") setSubtype(next);
                      }}
                    />
                    {errors.subtype !== undefined && (
                      <FieldError>{errors.subtype}</FieldError>
                    )}
                  </Field>
                )}
              </FormRow>

              <FormRow>
                <Field invalid={errors.code !== undefined} required>
                  <FieldLabel>{t("instruments.field.code")}</FieldLabel>
                  <TextField
                    name="code"
                    value={code}
                    maxLength={20}
                    autoCapitalize="characters"
                    onChange={(event) => {
                      setCode(event.target.value);
                    }}
                  />
                  {errors.code !== undefined && (
                    <FieldError>{errors.code}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.exchange !== undefined}>
                  <FieldLabel>{t("instruments.field.exchange")}</FieldLabel>
                  <TextField
                    name="exchange"
                    value={exchange}
                    maxLength={4}
                    autoCapitalize="characters"
                    onChange={(event) => {
                      setExchange(event.target.value.toUpperCase());
                    }}
                  />
                  {errors.exchange === undefined ? (
                    <FieldDescription>
                      {t("instruments.field.exchangeHint")}
                    </FieldDescription>
                  ) : (
                    <FieldError>{errors.exchange}</FieldError>
                  )}
                </Field>
              </FormRow>

              <Field invalid={errors.name !== undefined} required>
                <FieldLabel>{t("instruments.field.name")}</FieldLabel>
                <TextField
                  name="name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                {errors.name !== undefined && (
                  <FieldError>{errors.name}</FieldError>
                )}
              </Field>

              <FormRow>
                <Field invalid={errors.quote_currency !== undefined} required>
                  <FieldLabel>{t("instruments.field.quote")}</FieldLabel>
                  <ChoiceSelect
                    label={t("instruments.field.quote")}
                    choices={currencyChoices}
                    value={chosenQuote}
                    multiple={false}
                    invalid={errors.quote_currency !== undefined}
                    onChange={(next) => {
                      if (typeof next === "string") setQuote(next);
                    }}
                  />
                  {errors.quote_currency !== undefined && (
                    <FieldError>{errors.quote_currency}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.scale !== undefined} required>
                  <FieldLabel>{t("instruments.field.scale")}</FieldLabel>
                  <TextField
                    name="scale"
                    inputMode="numeric"
                    value={scale}
                    maxLength={2}
                    onChange={(event) => {
                      setScale(event.target.value.replace(/\D/g, ""));
                    }}
                  />
                  {errors.scale === undefined ? (
                    <FieldDescription>
                      {t("instruments.field.scaleHint")}
                    </FieldDescription>
                  ) : (
                    <FieldError>{errors.scale}</FieldError>
                  )}
                </Field>
              </FormRow>
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={define.isPending}>
            {t("instruments.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
