import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";

import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useT } from "@/i18n/i18n-provider";

// The inflation that separates the income of today's money from the income of the term's end.
export function IncomeAdjust() {
  const t = useT();
  const [search, set] = useCalculatorSearch();

  return (
    <FieldGroup kind="section">
      <FieldGroupLegend>{t("calc.compound.adjust")}</FieldGroupLegend>
      <FieldGroupContent>
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
      </FieldGroupContent>
    </FieldGroup>
  );
}
