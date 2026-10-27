import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";

import { AmountField } from "@/features/calculators/amount-field";
import styles from "@/features/calculators/calculators.module.css";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readInt,
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { ChoiceField } from "@/features/calculators/choice-field";
import { CountField } from "@/features/calculators/count-field";
import { impliedRate, presentValue } from "@/features/calculators/credit-math";
import { formatRate } from "@/features/calculators/format-rate";
import type { Source } from "@/features/calculators/method-section";
import { RateSourceFields } from "@/features/calculators/rate-source-fields";
import { monthlyToAnnual } from "@/features/calculators/rate-math";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useRateSource } from "@/features/calculators/use-rate-source";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const maxInstallments = 1200;

const sources: Source[] = [
  {
    title: "Resolução CMN nº 4.881, de 23 de dezembro de 2020",
    url: "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf",
  },
  {
    title:
      "Stango and Zinman 2009, Exponential Growth Bias and Household Finance, Journal of Finance 64(6)",
    url: "https://doi.org/10.1111/j.1540-6261.2009.01518.x",
  },
];

// Design §5, cash-or-installments: the monthly rate an installment plan implies against the cash
// price, and what the installments are worth today at a rate the person chooses.
export function CashOrInstallmentsCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const count = readInt(search.count, 1, maxInstallments);
  // ADR 026 E8: one month per installment.
  const compare = useRateSource(search, "compare", count ?? 12);
  if (money === null)
    return (
      <CalculatorFrame
        id="cash-or-installments"
        inputs={null}
        results={null}
        method={null}
      />
    );

  const cash = readMinor(search.cash);
  const installment = readMinor(search.installment);
  const firstNow = search.first === "now";

  let results = null;
  if (cash !== null && cash > 0 && count !== null && installment !== null) {
    const implied = impliedRate(cash, count, installment, firstNow);
    const total = {
      label: t("calc.cash.total"),
      value: money.format(count * installment),
    };
    const rows: Result[] = [];
    const rate =
      typeof implied === "number"
        ? {
            monthly: formatRate(implied, locale),
            annual: formatRate(monthlyToAnnual(implied), locale),
          }
        : null;
    const comparing = compare.monthly !== null && compare.annual !== null;
    // Without a comparison the monthly rate is the lead, which the list does not repeat.
    if (rate !== null && comparing)
      rows.push({ label: t("calc.cash.monthly"), value: rate.monthly });
    if (rate !== null)
      rows.push({ label: t("calc.cash.annual"), value: rate.annual });
    rows.push(total);
    let lead = null;
    if (compare.monthly !== null && compare.annual !== null) {
      const value = presentValue(count, installment, compare.monthly, firstNow);
      rows.push({
        label: t("calc.cash.presentValue"),
        value: money.format(value),
      });
      // A comparison states which figure is lower and by how much (design §2).
      lead = (
        <ResultLead
          label={t(
            value > cash
              ? "calc.cash.cashLower"
              : value < cash
                ? "calc.cash.installmentsLower"
                : "calc.cash.same",
          )}
          value={money.format(Math.abs(value - cash))}
          summary={t("calc.cash.verdictSummary", {
            rate: formatRate(compare.annual, locale),
            value: money.format(value),
          })}
        />
      );
    } else if (rate !== null)
      lead = (
        <ResultLead
          label={t("calc.cash.monthly")}
          value={rate.monthly}
          summary={t("calc.cash.summary", rate)}
        />
      );
    results = (
      <Stack gap={5}>
        {implied === "no_interest" && (
          <InlineMessage tone="info">{t("calc.cash.noInterest")}</InlineMessage>
        )}
        {implied === null && (
          <InlineMessage tone="warning">
            {t("calc.cash.noSolution")}
          </InlineMessage>
        )}
        {lead}
        <ResultList results={rows} />
      </Stack>
    );
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.cash.price")}
        value={search.cash}
        money={money}
        onChange={(v) => {
          set({ cash: v });
        }}
      />
      <div className={styles.pair}>
        <CountField
          label={t("calc.cash.count")}
          unit={t("calc.unit.installments")}
          name="count"
          value={search.count ?? ""}
          onChange={(v) => {
            set({ count: v });
          }}
        />
        <AmountField
          label={t("calc.cash.installment")}
          value={search.installment}
          money={money}
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      </div>
      <ChoiceField
        label={t("calc.cash.first")}
        choices={[
          { value: "later", label: t("calc.cash.first.later") },
          { value: "now", label: t("calc.cash.first.now") },
        ]}
        value={firstNow ? "now" : "later"}
        onChange={(next) => {
          set({ first: next === "now" ? "now" : undefined });
        }}
      />
    </>
  );

  const options = (
    <RateSourceFields
      label={t("calc.cash.compare")}
      hint={t("calc.cash.compare.hint")}
      sourceLabel={t("calc.cash.rateSource")}
      source={compare}
      set={set}
    />
  );

  return (
    <CalculatorFrame
      id="cash-or-installments"
      inputs={inputs}
      options={options}
      results={results}
      method={
        <CalculatorMethod
          id="cash-or-installments"
          sources={sources}
          noIndexes={compare.noIndexes}
        />
      }
    />
  );
}
