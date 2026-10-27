import { Field, FieldLabel } from "@slotted/react/field";

import { FilledNote } from "@/features/calculators/filled-note";
import { formatRate } from "@/features/calculators/format-rate";
import { RateField } from "@/features/calculators/rate-field";
import type { RateSource } from "@/features/calculators/use-rate-source";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

// The fields of a RateSource: the choice of a fixed rate or a daily index, the percent of the
// index, and the rate itself, which names its origin while it comes from the index. Typing in
// the rate makes it fixed again.
export function RateSourceFields({
  label,
  sourceLabel,
  source,
  set,
}: {
  label: string;
  sourceLabel: string;
  source: RateSource;
  set: (patch: Record<string, string | undefined>) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const { keys, index, fromIndex, percent } = source;
  return (
    <>
      {source.daily.length > 0 && (
        <Field>
          <FieldLabel>{sourceLabel}</FieldLabel>
          <ChoiceSelect
            label={sourceLabel}
            choices={[
              { value: "", label: t("calc.rateSource.fixed") },
              ...source.daily.map((i) => ({
                value: i.id,
                label: i.id.toUpperCase(),
              })),
            ]}
            value={index?.id ?? ""}
            multiple={false}
            onChange={(next) => {
              set(
                typeof next === "string" && next !== ""
                  ? { [keys.index]: next, [keys.rate]: undefined }
                  : { [keys.index]: undefined, [keys.percent]: undefined },
              );
            }}
          />
        </Field>
      )}
      {index !== undefined && (
        <RateField
          label={t("calc.compound.percent")}
          name={keys.percent}
          value={source.percentText}
          onChange={(v) => {
            set({ [keys.percent]: v });
          }}
        />
      )}
      <RateField
        label={label}
        name={keys.rate}
        value={source.text}
        onChange={(v) => {
          set({
            [keys.rate]: v,
            [keys.index]: undefined,
            [keys.percent]: undefined,
          });
        }}
        period={source.period}
        onPeriodChange={(p) => {
          set({
            [keys.period]: p === "month" ? "month" : undefined,
            [keys.index]: undefined,
            [keys.percent]: undefined,
          });
        }}
      >
        {index !== undefined && fromIndex !== null && percent !== null && (
          <FilledNote
            origin={t("calc.origin.daily", {
              percent: formatRate(percent, locale),
              index: index.id.toUpperCase(),
              date: formatDate(fromIndex.to, locale),
            })}
          />
        )}
      </RateField>
    </>
  );
}
