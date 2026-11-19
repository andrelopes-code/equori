import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Stack } from "@slotted/react/stack";

import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";
import { DelayField } from "@/features/calculators/compound-calculator/delay-field";
import { WithdrawField } from "@/features/calculators/compound-calculator/withdraw-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/compound-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

// The adjustments of the income: the inflation that separates today's money from the term's end,
// a later start (the balance compounds before the income starts) and a withdrawal term. The
// volatility range is specified for the final amount only.
export function IncomeAdjust() {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <FieldGroup kind="section">
      <FieldGroupLegend>{t("calc.compound.adjust")}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={8}>
          <RateField
            compact
            label={t("calc.compound.inflation")}
            help={t("calc.compound.inflation.help")}
            name="inflation"
            value={search.inflation ?? ""}
            onChange={(v) => {
              set({ inflation: v });
            }}
          />

          <OptionalGroups
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
