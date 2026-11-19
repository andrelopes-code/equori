import { Tab, TabList, TabPanel, Tabs } from "@slotted/react/tabs";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import { CalculatorDetails } from "@/features/calculators/calculator-frame/calculator-details";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type { AmortizationRow } from "@/features/calculators/financing-calculator/annuity";
import { systemNames } from "@/features/calculators/financing-calculator/financing-region";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

interface FinancingDetailsProps {
  price: AmortizationRow[];
  sac: AmortizationRow[];
  money: CalculatorMoney;
}

export function FinancingDetails({ price, sac, money }: FinancingDetailsProps) {
  const t = useT();
  const { locale } = useAppLocaleState();
  const names = systemNames(locale.region);

  const systems = [
    {
      value: "price",
      name: t(names.price),
      caption: t(names.priceTable),
      rows: price,
    },
    { value: "sac", name: t(names.sac), caption: t(names.sacTable), rows: sac },
  ];
  const columns = [
    t("calc.financing.col.month"),
    t("calc.financing.col.installment"),
    t("calc.financing.col.interest"),
    t("calc.financing.col.amortization"),
    t("calc.financing.col.balance"),
  ];

  return (
    <CalculatorDetails
      title={t("calc.financing.details")}
      size={t("calc.financing.details.size", {
        months: String(price.length),
        priceName: t(names.price),
        sacName: t(names.sac),
      })}
    >
      <Tabs defaultValue="price">
        <TabList>
          {systems.map((system) => (
            <Tab key={system.value} value={system.value}>
              {system.name}
            </Tab>
          ))}
        </TabList>

        {systems.map((system) => (
          <TabPanel key={system.value} value={system.value}>
            <CalcTable
              long
              caption={system.caption}
              headers={columns}
              rows={system.rows.map((row) => ({
                key: String(row.month),
                cells: [
                  String(row.month),
                  money.format(row.installment),
                  money.format(row.interest),
                  money.format(row.amortization),
                  money.format(row.balance),
                ],
              }))}
            />
          </TabPanel>
        ))}
      </Tabs>
    </CalculatorDetails>
  );
}
