import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Stack } from "@slotted/react/stack";

import { OptionalGroup } from "@/features/calculators/calculator-frame/optional-group";
import { InflationField } from "@/features/calculators/compound-calculator/inflation-field";
import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import { withdrawUnits } from "@/features/calculators/compound-calculator/use-accumulation";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { termUnits, unitPatch } from "@/features/calculators/model/duration";
import { useT } from "@/i18n/i18n-provider";

interface AccumulationAdjustProps {
  input: AccumulationInput;
}

// The adjustments of the final amount: the inflation and the volatility, and two optional
// groups, a later start and a withdrawal term.
export function AccumulationAdjust({ input }: AccumulationAdjustProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch();
  const { delayUnit, withdrawUnit } = input;

  return (
    <FieldGroup kind="section">
      <FieldGroupLegend>{t("calc.compound.adjust")}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={6}>
          <InflationField input={input} />

          <RateField
            compact
            label={t("calc.compound.volatility")}
            help={t("calc.compound.volatility.help")}
            name="volatility"
            value={search.volatility ?? ""}
            onChange={(v) => {
              set({ volatility: v });
            }}
          />

          <OptionalGroup
            keys={["delay", "delayUnit"]}
            add={t("calc.compound.delay.add")}
            legend={t("calc.compound.delay.add")}
            remove={t("calc.compound.delay.remove")}
          >
            <DurationField
              compact
              label={t("calc.compound.delay")}
              name="delay"
              value={search.delay ?? ""}
              onChange={(v) => {
                set({ delay: v });
              }}
              unit={delayUnit}
              units={termUnits}
              onUnitChange={(u) => {
                set(unitPatch("delay", search.delay, delayUnit, u));
              }}
            />
          </OptionalGroup>

          <OptionalGroup
            keys={["withdraw", "withdrawUnit"]}
            add={t("calc.compound.withdraw.add")}
            legend={t("calc.compound.withdraw.add")}
            remove={t("calc.compound.withdraw.remove")}
          >
            <DurationField
              compact
              label={t("calc.compound.withdraw")}
              name="withdraw"
              value={search.withdraw ?? ""}
              onChange={(v) => {
                set({ withdraw: v });
              }}
              unit={withdrawUnit}
              units={withdrawUnits}
              onUnitChange={(u) => {
                set(
                  unitPatch(
                    "withdraw",
                    search.withdraw,
                    withdrawUnit,
                    u,
                    withdrawUnits,
                  ),
                );
              }}
            />
          </OptionalGroup>
        </Stack>
      </FieldGroupContent>
    </FieldGroup>
  );
}
