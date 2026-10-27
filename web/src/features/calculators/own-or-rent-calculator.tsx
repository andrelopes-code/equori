import { Stack } from "@slotted/react/stack";

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
import { ResultLead } from "@/features/calculators/result-lead";
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

const rateFields: readonly {
  key: RateKey;
  label: MessageKey;
  hint: MessageKey;
}[] = [
  {
    key: "riskFree",
    label: "calc.own.riskFree",
    hint: "calc.own.riskFree.hint",
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
    hint: "calc.own.appreciationRate.hint",
  },
  {
    key: "riskPremium",
    label: "calc.own.riskPremiumRate",
    hint: "calc.own.riskPremiumRate.hint",
  },
  {
    key: "deductibleTax",
    label: "calc.own.deductibleTax",
    hint: "calc.own.deductibleTax.hint",
  },
  {
    key: "mortgage",
    label: "calc.own.mortgage",
    hint: "calc.own.mortgage.hint",
  },
];

// The deduction exists only where mortgage interest is deductible: its two rates default to 0
// and stand apart from the rates every home has.
const deductionKeys: ReadonlySet<RateKey> = new Set([
  "deductibleTax",
  "mortgage",
]);

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
  const rates = Object.fromEntries(
    rateFields.map(({ key }) => [
      key,
      deductionKeys.has(key) && search[key] === undefined
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
      <Stack gap={5}>
        {/* A comparison states which figure is lower and by how much (design §2). */}
        <ResultLead
          label={t(
            difference > 0
              ? "calc.own.rentLower"
              : difference < 0
                ? "calc.own.ownLower"
                : "calc.own.same",
          )}
          value={money.format(Math.abs(difference))}
          summary={t("calc.own.summary", {
            own: money.format(got.total),
            rent: money.format(rent),
          })}
        />
        <ResultList
          results={[
            { label: t("calc.own.total"), value: money.format(got.total) },
            { label: t("calc.own.rentYear"), value: money.format(rent) },
            ...(Object.keys(componentLabels) as OwnershipComponent[]).map(
              (c) => ({
                label: t(componentLabels[c]),
                value: money.format(got.components[c]),
              }),
            ),
          ]}
        />
      </Stack>
    );
  }

  const rateField = ({ key, label, hint }: (typeof rateFields)[number]) => (
    <RateField
      key={key}
      label={t(label)}
      hint={t(hint)}
      name={key}
      value={search[key] ?? (deductionKeys.has(key) ? "0" : "")}
      onChange={(v) => {
        set({ [key]: v });
      }}
    />
  );

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
        hint={t("calc.own.rent.hint")}
        value={search.rent}
        money={money}
        onChange={(v) => {
          set({ rent: v });
        }}
      />
      {rateFields.filter((f) => !deductionKeys.has(f.key)).map(rateField)}
    </>
  );

  const options = rateFields
    .filter((f) => deductionKeys.has(f.key))
    .map(rateField);

  return (
    <CalculatorFrame
      id="own-or-rent"
      inputs={inputs}
      options={options}
      results={results}
      method={<CalculatorMethod id="own-or-rent" sources={sources} />}
    />
  );
}
