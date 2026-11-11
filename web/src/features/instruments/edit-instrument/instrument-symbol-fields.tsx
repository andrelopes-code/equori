import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { marketDataFeedsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

interface InstrumentSymbolFieldsProps {
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (source: string, value: string) => void;
}

// One field per source that reads a symbol set on the instrument (A222 MQ38).
export function InstrumentSymbolFields({
  values,
  errors,
  onChange,
}: InstrumentSymbolFieldsProps) {
  const t = useT();
  const api = useApi();
  const feeds = useQuery(marketDataFeedsQuery(api));

  if (feeds.data === undefined) return null;

  return feeds.data
    .filter((f) => f.symbol_override)
    .map((f) => (
      <Field key={f.id} invalid={errors[`symbols.${f.id}`] !== undefined}>
        <FieldLabel>
          {t("instruments.symbol.label", { source: sourceLabel(t, f.id) })}
        </FieldLabel>
        <TextField
          name={`symbol-${f.id}`}
          value={values[f.id] ?? ""}
          maxLength={40}
          onChange={(event) => {
            onChange(f.id, event.target.value);
          }}
        />
        {errors[`symbols.${f.id}`] === undefined ? (
          <FieldDescription>{t("instruments.symbol.hint")}</FieldDescription>
        ) : (
          <FieldError>{errors[`symbols.${f.id}`]}</FieldError>
        )}
      </Field>
    ));
}
