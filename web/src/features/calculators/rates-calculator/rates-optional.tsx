import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/rates-calculator/address-keys";
import {
  clearFloating,
  floatingKeys,
} from "@/features/calculators/rate-source/floating";
import type { Floating } from "@/features/calculators/rate-source/floating";
import { FloatingFields } from "@/features/calculators/rate-source/floating-fields";
import { IndexChoice } from "@/features/calculators/rate-source/index-choice";
import { useT } from "@/i18n/i18n-provider";

interface RatesOptionalProps {
  // The daily indexes the instance stores; the index group is offered only when there is one.
  daily: { id: string; expected: boolean }[];
  index: { id: string; expected: boolean } | undefined;
  floating: Floating;
}

export function RatesOptional({ daily, index, floating }: RatesOptionalProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  const inflation = {
    keys: ["inflation"] as const,
    add: t("calc.rates.inflation.add"),
    legend: t("calc.rates.inflation.legend"),
    remove: t("calc.rates.inflation.remove"),
    children: (
      <RateField
        compact
        label={t("calc.rates.inflation")}
        hint={t("calc.rates.inflation.hint")}
        help={t("calc.rates.real.help")}
        name="inflation"
        value={search.inflation ?? ""}
        onChange={(v) => {
          set({ inflation: v });
        }}
      />
    ),
  };
  const ofIndex = {
    keys: ["index", "form", "percent", "spread", "basis"] as const,
    add: t("calc.rates.index.add"),
    legend: t("calc.rates.index.legend"),
    remove: t("calc.rates.index.remove"),
    children: (
      <>
        <IndexChoice
          label={t("calc.index")}
          hint={t("calc.rates.index.hint")}
          none={t("calc.index.none")}
          indexes={daily}
          value={index?.id}
          onChange={(next) => {
            set({ ...clearFloating(floatingKeys), index: next });
          }}
        />

        {index !== undefined && (
          <FloatingFields
            indexId={index.id}
            expected={index.expected}
            floating={floating}
            keys={floatingKeys}
            percentLabel={t("calc.rates.percent")}
            percentHelp={t("calc.rates.ofIndex.help")}
            set={set}
          />
        )}
      </>
    ),
  };

  return (
    <OptionalGroups
      addressKeys={addressKeys}
      groups={daily.length > 0 ? [inflation, ofIndex] : [inflation]}
    />
  );
}
