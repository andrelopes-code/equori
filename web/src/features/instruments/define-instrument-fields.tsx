import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import type { components } from "@/api/schema.gen";
import {
  none,
  type useInstrumentDefine,
} from "@/features/instruments/use-instrument-define";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormLayout } from "@/ui/form-layout";
import { FormNotice } from "@/ui/form-notice";
import { FormRow } from "@/ui/form-row";

type InstrumentType = components["schemas"]["InstrumentType"];

interface DefineInstrumentFieldsProps {
  form: ReturnType<typeof useInstrumentDefine>;
}

export function DefineInstrumentFields({ form }: DefineInstrumentFieldsProps) {
  const t = useT();
  const {
    code,
    setCode,
    type,
    setType,
    scale,
    setScale,
    name,
    setName,
    setQuote,
    exchange,
    setExchange,
    subtype,
    setSubtype,
    errors,
    summary,
    subtypeChoices,
    typeChoices,
    currencyChoices,
    chosenQuote,
    chosenScale,
  } = form;

  return (
    <FormLayout>
      {summary !== null && <FormNotice>{summary}</FormNotice>}

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
          {errors.type !== undefined && <FieldError>{errors.type}</FieldError>}
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
          {errors.code !== undefined && <FieldError>{errors.code}</FieldError>}
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
        {errors.name !== undefined && <FieldError>{errors.name}</FieldError>}
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
            placeholder={chosenScale === null ? undefined : String(chosenScale)}
            maxLength={2}
            onChange={(event) => {
              setScale(event.target.value.replace(/\D/g, ""));
            }}
          />
          {errors.scale === undefined ? (
            <FieldDescription>
              {chosenScale === null
                ? t("instruments.field.scaleHint")
                : t("instruments.field.scaleHintType", { value: chosenScale })}
            </FieldDescription>
          ) : (
            <FieldError>{errors.scale}</FieldError>
          )}
        </Field>
      </FormRow>
    </FormLayout>
  );
}
