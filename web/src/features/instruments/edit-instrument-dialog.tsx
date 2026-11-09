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
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { subtypesQuery } from "@/features/instruments/api";
import { InstrumentSymbolFields } from "@/features/instruments/instrument-symbol-fields";
import { subtypeLabel } from "@/features/instruments/instrument-labels";
import {
  none,
  useInstrumentEdit,
} from "@/features/instruments/use-instrument-edit";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormNotice } from "@/ui/form-notice";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

interface EditInstrumentDialogProps {
  instrument: components["schemas"]["Instrument"];
  onDone: () => void;
  onCancel: () => void;
}

// Edits the name, exchange and subtype of a security (A134); a cleared exchange or subtype is
// sent as absent, which clears it.
export function EditInstrumentDialog({
  instrument,
  onDone,
  onCancel,
}: EditInstrumentDialogProps) {
  const t = useT();
  const api = useApi();
  const overlayOpen = useOverlayOpen();
  const {
    name,
    setName,
    exchange,
    setExchange,
    subtype,
    setSubtype,
    symbols,
    setSymbols,
    errors,
    summary,
    isPending,
    submit,
  } = useInstrumentEdit(instrument, onDone);
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
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("instrument.edit")}</DialogTitle>
            <DialogDescription>
              {t("instrument.edit.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormLayout>
              {summary !== null && <FormNotice>{summary}</FormNotice>}

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
              </FormRow>

              <InstrumentSymbolFields
                values={symbols}
                errors={errors}
                onChange={(source, value) => {
                  setSymbols({ ...symbols, [source]: value });
                }}
              />
            </FormLayout>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={isPending}>
              {t("instrument.edit.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
