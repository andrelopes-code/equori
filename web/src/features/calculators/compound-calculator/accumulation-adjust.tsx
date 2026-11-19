import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Stack } from "@slotted/react/stack";

import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";
import { DelayField } from "@/features/calculators/compound-calculator/delay-field";
import { InflationField } from "@/features/calculators/compound-calculator/inflation-field";
import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import { WithdrawField } from "@/features/calculators/compound-calculator/withdraw-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/compound-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

interface AccumulationAdjustProps {
  input: AccumulationInput;
}

// The adjustments of the final amount: the inflation and the volatility, and two optional
// groups, a later start and a withdrawal term.
export function AccumulationAdjust({ input }: AccumulationAdjustProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <FieldGroup kind="section">
      <FieldGroupLegend>{t("calc.compound.adjust")}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={8}>
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

          <OptionalGroups
            addressKeys={addressKeys}
            groups={[
              {
                keys: ["delay", "delayUnit"],
                add: t("calc.compound.delay.add"),
                legend: t("calc.compound.delay.add"),
                remove: t("calc.compound.delay.remove"),
                children: <DelayField />,
              },
              {
                keys: ["withdraw", "withdrawUnit"],
                add: t("calc.compound.withdraw.add"),
                legend: t("calc.compound.withdraw.add"),
                remove: t("calc.compound.withdraw.remove"),
                children: <WithdrawField />,
              },
            ]}
          />
        </Stack>
      </FieldGroupContent>
    </FieldGroup>
  );
}
