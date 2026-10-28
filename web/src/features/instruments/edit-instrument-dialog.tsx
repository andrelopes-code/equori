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
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { subtypesQuery, useEditInstrument } from "@/features/instruments/api";
import { subtypeLabel } from "@/features/instruments/instrument-labels";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// Stands for "no subtype" in the select; a subtype matches ^[a-z0-9_]{2,40}$, so it never collides.
const none = "-";

// Edits the name, exchange and subtype of a security (A134); a cleared exchange or subtype is
// sent as absent, which clears it.
export function EditInstrumentDialog({
  instrument,
  onDone,
  onCancel,
}: {
  instrument: components["schemas"]["Instrument"];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const api = useApi();
  const formId = useId();
  const overlayOpen = useOverlayOpen();
  const edit = useEditInstrument();
  const [name, setName] = useState(instrument.name);
  const [exchange, setExchange] = useState(instrument.exchange ?? "");
  const [subtype, setSubtype] = useState(instrument.subtype ?? none);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const subtypes = useQuery(subtypesQuery(api, instrument.type));
  const subtypeChoices = useMemo(() => {
    const codes = subtypes.data ?? [];
    // A stored subtype outside the jurisdiction's list stays selectable.
    const all =
      instrument.subtype === undefined || codes.includes(instrument.subtype)
        ? codes
        : [instrument.subtype, ...codes];
    return [
      { value: none, label: t("instruments.subtype.none") },
      ...all.map((s) => ({ value: s, label: subtypeLabel(t, s) })),
    ];
  }, [subtypes.data, instrument.subtype, t]);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const submit = () => {
    setSummary(null);
    if (name.trim() === "") {
      setErrors({ name: t("instruments.required") });
      return;
    }
    setErrors({});
    edit
      .mutateAsync({
        code: instrument.code,
        edit: {
          name: name.trim(),
          ...(exchange.trim() === "" ? {} : { exchange: exchange.trim() }),
          ...(subtype === none ? {} : { subtype }),
        },
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
    <Dialog open={overlayOpen} size="lg" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("instrument.edit")}</DialogTitle>
          <DialogDescription>
            {t("instrument.edit.description")}
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
            <Stack gap={4}>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}
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
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={edit.isPending}>
            {t("instrument.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
