import { Field, FieldLabel } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

// The valuation currency is chosen among the currencies of the instrument catalog, as in the
// portfolio.
export function ValuationCurrency({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (code: string) => void;
}) {
  const t = useT();
  const instruments = useQuery(instrumentsQuery(useApi()));
  const currencies = (instruments.data?.items ?? [])
    .filter((i) => i.type === "currency")
    .map((i) => ({ value: i.code, label: i.code }));
  return (
    <Field>
      <FieldLabel>{t("report.valueIn")}</FieldLabel>
      <ChoiceSelect
        label={t("report.valueIn")}
        choices={currencies}
        multiple={false}
        value={value ?? null}
        onChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      />
    </Field>
  );
}
