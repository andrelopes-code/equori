import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";

import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import { FilledNote } from "@/features/calculators/fields/filled-note";
import { indexedRateText } from "@/features/calculators/compound-calculator/compound-fields";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/compound-calculator/address-keys";
import { indexName } from "@/features/calculators/rate-source/index-catalog";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface InflationFieldProps {
  input: Pick<
    AccumulationInput,
    "inflationIndex" | "fromInflationIndex" | "monthly"
  >;
}

// A yearly inflation, typed or taken from a monthly index.
export function InflationField({ input }: InflationFieldProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const [search, set] = useCalculatorSearch(addressKeys);
  const { inflationIndex, fromInflationIndex, monthly } = input;

  return (
    <RateField
      compact
      label={t("calc.compound.inflation")}
      help={t("calc.compound.inflation.help")}
      name="inflation"
      value={indexedRateText(
        search.inflation,
        inflationIndex !== undefined,
        fromInflationIndex,
      )}
      onChange={(v) => {
        set({ inflation: v, inflationIndex: undefined });
      }}
    >
      {inflationIndex !== undefined && fromInflationIndex !== null ? (
        <FilledNote
          origin={t("calc.origin.monthly", {
            index: indexName(inflationIndex.id),
            date: formatDate(fromInflationIndex.to, locale),
          })}
        />
      ) : (
        monthly.length > 0 && (
          <Inline gap={2}>
            {monthly.map((i) => (
              <Button
                key={i.id}
                size="sm"
                variant="outline"
                tone="secondary"
                onClick={() => {
                  set({ inflationIndex: i.id, inflation: undefined });
                }}
              >
                {t("calc.useIndex", { index: indexName(i.id) })}
              </Button>
            ))}
          </Inline>
        )
      )}
    </RateField>
  );
}
