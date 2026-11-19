import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Stack } from "@slotted/react/stack";

import { OptionalGroup } from "@/features/calculators/calculator-frame/optional-group";
import { WithdrawField } from "@/features/calculators/compound-calculator/withdraw-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useT } from "@/i18n/i18n-provider";

// The adjustments of the income: the inflation that separates today's money from the term's end,
// and a withdrawal term. A volatility and a later start have no meaning here: the balance earns the
// rate every month and no deposit follows it.
export function IncomeAdjust() {
  const t = useT();
  const [search, set] = useCalculatorSearch();

  return (
    <FieldGroup kind="section">
      <FieldGroupLegend>{t("calc.compound.adjust")}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={6}>
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

          <OptionalGroup
            keys={["withdraw", "withdrawUnit"]}
            add={t("calc.compound.withdraw.add")}
            legend={t("calc.compound.withdraw.add")}
            remove={t("calc.compound.withdraw.remove")}
          >
            <WithdrawField />
          </OptionalGroup>
        </Stack>
      </FieldGroupContent>
    </FieldGroup>
  );
}
