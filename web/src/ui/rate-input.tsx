import { Inline } from "@slotted/react/inline";
import { TextField } from "@slotted/react/text-field";

import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

export type RatePeriod = "month" | "year";

// A rate typed in percent, with the period it is quoted for when the calculator asks for one.
// Families read: number-field, text-field. A number field holds a float and steps it; a rate is
// typed as written in a contract, so the text stays the reader's own ("1.5", "12.68").
export function RateInput({
  value,
  onChange,
  name,
  period,
  onPeriodChange,
}: {
  value: string;
  onChange: (text: string) => void;
  name: string;
  period?: RatePeriod;
  onPeriodChange?: (period: RatePeriod) => void;
}) {
  const t = useT();
  const field = (
    <TextField
      name={name}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      end={t("calc.percent")}
      onChange={(event) => {
        onChange(event.target.value.replace(",", "."));
      }}
    />
  );
  if (period === undefined || onPeriodChange === undefined) return field;
  return (
    <Inline gap={2} wrap="nowrap">
      {field}
      <ChoiceSelect
        label={t("calc.period")}
        choices={[
          { value: "month", label: t("calc.period.month") },
          { value: "year", label: t("calc.period.year") },
        ]}
        value={period}
        multiple={false}
        onChange={(next) => {
          if (next === "month" || next === "year") onPeriodChange(next);
        }}
      />
    </Inline>
  );
}
