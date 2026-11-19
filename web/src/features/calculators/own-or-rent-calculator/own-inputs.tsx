import { AmountField } from "@/features/calculators/fields/amount-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/own-or-rent-calculator/address-keys";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

interface OwnInputsProps {
  money: CalculatorMoney;
}

type RateKey = Extract<
  (typeof addressKeys)[number],
  "riskFree" | "propertyTax" | "maintenance" | "appreciation" | "riskPremium"
>;

// A rate with a term to define takes its definition as help beside the label; the others keep a
// hint below the input.
const rates: readonly {
  key: RateKey;
  label: MessageKey;
  hint?: MessageKey;
  help?: MessageKey;
}[] = [
  {
    key: "riskFree",
    label: "calc.own.riskFree",
    help: "calc.own.forgone.help",
  },
  {
    key: "propertyTax",
    label: "calc.own.propertyTax",
    hint: "calc.own.propertyTax.hint",
  },
  {
    key: "maintenance",
    label: "calc.own.maintenanceRate",
    hint: "calc.own.maintenanceRate.hint",
  },
  {
    key: "appreciation",
    label: "calc.own.appreciationRate",
    help: "calc.own.appreciation.help",
  },
  {
    key: "riskPremium",
    label: "calc.own.riskPremiumRate",
    help: "calc.own.riskPremium.help",
  },
];

export function OwnInputs({ money }: OwnInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <>
      <AmountField
        label={t("calc.own.price")}
        width="medium"
        value={search.price}
        money={money}
        onChange={(v) => {
          set({ price: v });
        }}
      />

      <AmountField
        label={t("calc.own.rent")}
        hint={t("calc.own.rent.hint")}
        width="medium"
        value={search.rent}
        money={money}
        onChange={(v) => {
          set({ rent: v });
        }}
      />

      {rates.map(({ key, label, hint, help }) => (
        <RateField
          key={key}
          label={t(label)}
          {...(hint === undefined ? {} : { hint: t(hint) })}
          {...(help === undefined ? {} : { help: t(help) })}
          compact
          name={key}
          value={search[key] ?? ""}
          onChange={(v) => {
            set({ [key]: v });
          }}
        />
      ))}
    </>
  );
}
