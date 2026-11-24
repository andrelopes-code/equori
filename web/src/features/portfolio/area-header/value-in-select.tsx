import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface ValueInSelectProps {
  valueIn: string | undefined;
  base: string | undefined;
  onChange: (next: string | undefined) => void;
}

// The valuation currency is chosen among the currencies of the instrument catalog.
export function ValueInSelect({ valueIn, base, onChange }: ValueInSelectProps) {
  const t = useT();
  const instruments = useQuery(instrumentsQuery(useApi()));

  const currencies = (instruments.data?.items ?? [])
    .filter((i) => i.type === "currency")
    .map((i) => ({ value: i.code, label: i.code }));

  return (
    <ChoiceSelect
      label={t("portfolio.valueIn")}
      choices={currencies}
      multiple={false}
      value={valueIn ?? null}
      onChange={(next) => {
        if (typeof next === "string")
          onChange(next === base ? undefined : next);
      }}
    />
  );
}
