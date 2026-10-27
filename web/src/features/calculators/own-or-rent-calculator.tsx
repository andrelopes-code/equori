import { AmountField } from "@/features/calculators/amount-field";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import type { Source } from "@/features/calculators/method-section";
import { ownershipCost } from "@/features/calculators/plan-math";
import type { OwnershipComponent } from "@/features/calculators/plan-math";
import { RateField } from "@/features/calculators/rate-field";
import { ResultList } from "@/features/calculators/result-list";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const sources: Source[] = [
  {
    title:
      "Himmelberg, Mayer and Sinai 2005, Assessing High House Prices: Bubbles, Fundamentals, and Misperceptions (NBER w11643)",
    url: "https://realestate.wharton.upenn.edu/wp-content/uploads/2017/03/522.pdf",
  },
];

type RateKey =
  | "riskFree"
  | "propertyTax"
  | "deductibleTax"
  | "mortgage"
  | "maintenance"
  | "appreciation"
  | "riskPremium";

const rateFields: readonly { key: RateKey; label: MessageKey }[] = [
  { key: "riskFree", label: "calc.own.riskFree" },
  { key: "propertyTax", label: "calc.own.propertyTax" },
  { key: "deductibleTax", label: "calc.own.deductibleTax" },
  { key: "mortgage", label: "calc.own.mortgage" },
  { key: "maintenance", label: "calc.own.maintenanceRate" },
  { key: "appreciation", label: "calc.own.appreciationRate" },
  { key: "riskPremium", label: "calc.own.riskPremiumRate" },
];

const componentLabels: Record<OwnershipComponent, MessageKey> = {
  forgone: "calc.own.forgone",
  propertyTax: "calc.own.propertyTaxCost",
  deduction: "calc.own.deduction",
  maintenance: "calc.own.maintenance",
  appreciation: "calc.own.appreciation",
  riskPremium: "calc.own.riskPremium",
};

// Design §5, own-or-rent: the annual cost of owning a home in six components (study §3.5)
// against the annual rent.
export function OwnOrRentCalculator() {
  const t = useT();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  if (money === null)
    return (
      <CalculatorFrame
        id="own-or-rent"
        inputs={null}
        results={null}
        method={null}
      />
    );

  const price = readMinor(search.price);
  const rent = readMinor(search.rent);
  // The deductible tax rate defaults to 0: the deduction exists only where interest is deductible.
  const rates = Object.fromEntries(
    rateFields.map(({ key }) => [
      key,
      key === "deductibleTax" && search[key] === undefined
        ? 0
        : readRate(search[key]),
    ]),
  ) as Record<RateKey, number | null>;
  const complete = Object.values(rates).every((r) => r !== null);

  let results = null;
  if (price !== null && rent !== null && complete) {
    const got = ownershipCost({ price, ...(rates as Record<RateKey, number>) });
    const difference = got.total - rent;
    results = (
      <ResultList
        results={[
          ...(Object.keys(componentLabels) as OwnershipComponent[]).map(
            (c) => ({
              label: t(componentLabels[c]),
              value: money.format(got.components[c]),
            }),
          ),
          { label: t("calc.own.total"), value: money.format(got.total) },
          { label: t("calc.own.rentYear"), value: money.format(rent) },
          // A comparison states which figure is lower and by how much (design §2).
          {
            label: t(
              difference > 0
                ? "calc.own.rentLower"
                : difference < 0
                  ? "calc.own.ownLower"
                  : "calc.own.same",
            ),
            value: money.format(Math.abs(difference)),
          },
        ]}
      />
    );
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.own.price")}
        value={search.price}
        money={money}
        onChange={(v) => {
          set({ price: v });
        }}
      />
      <AmountField
        label={t("calc.own.rent")}
        value={search.rent}
        money={money}
        onChange={(v) => {
          set({ rent: v });
        }}
      />
      {rateFields.map(({ key, label }) => (
        <RateField
          key={key}
          label={t(label)}
          name={key}
          value={search[key] ?? (key === "deductibleTax" ? "0" : "")}
          onChange={(v) => {
            set({ [key]: v });
          }}
        />
      ))}
    </>
  );

  return (
    <CalculatorFrame
      id="own-or-rent"
      inputs={inputs}
      results={results}
      method={<CalculatorMethod id="own-or-rent" sources={sources} />}
    />
  );
}
