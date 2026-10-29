import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";

import { AmountField } from "@/features/calculators/amount-field";
import { CalcTable } from "@/features/calculators/calc-table";
import styles from "@/features/calculators/calculators.module.css";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readDate,
  readInt,
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { CountField } from "@/features/calculators/count-field";
import {
  effectiveAnnualCost,
  monthlyDates,
} from "@/features/calculators/credit-math";
import { formatRate } from "@/features/calculators/format-rate";
import type { Source } from "@/features/calculators/method-section";
import { annualToMonthly } from "@/features/calculators/rate-math";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import { roundHalfEven } from "@/features/calculators/round";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";

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

// The words a region gives this cost (CLAUDE.md, Regions): the name its law gives it, said after
// the method's steps, and the label of the nominal annual rate its contracts state instead,
// shown beside the effective cost.
function regionalTerms(region: string): {
  note: MessageKey | null;
  nominal: MessageKey | null;
} {
  switch (region) {
    case "BR":
      return { note: "calc.credit.cet", nominal: null };
    // A contract states the APR: the monthly rate times 12 (Regulation Z, 12 CFR 1026.22 and
    // appendix J).
    case "US":
      return { note: "calc.credit.us.aprNote", nominal: "calc.credit.us.apr" };
    default:
      return { note: null, nominal: null };
  }
}

function daysBetween(from: string, to: string): number {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000
  );
}

// Design §5, credit-cost: the annual rate at which the installments of an offer, each discounted
// by its days from the release, equal the amount released less the fees paid upfront
// (CMN 4.881, art. 4).
export function CreditCostCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const today = useToday();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const terms = regionalTerms(profile.region);
  const method = (
    <CalculatorMethod
      id="credit-cost"
      sources={sources}
      notes={terms.note === null ? [] : [t(terms.note)]}
    />
  );
  if (money === null)
    return (
      <CalculatorFrame
        id="credit-cost"
        inputs={null}
        results={null}
        method={method}
      />
    );

  const released = readMinor(search.released);
  const fees = readMinor(search.fees) ?? 0;
  const installment = readMinor(search.installment);
  const count = readInt(search.count, 1, maxInstallments);
  const releaseDate = readDate(search.releaseDate) ?? today;
  const firstDue = readDate(search.firstDue);

  let results = null;
  let details;
  if (firstDue !== null && firstDue <= releaseDate)
    results = (
      <Alert tone="warning">
        <AlertContent>
          <AlertDescription>{t("calc.credit.order")}</AlertDescription>
        </AlertContent>
      </Alert>
    );
  else if (
    released !== null &&
    installment !== null &&
    count !== null &&
    firstDue !== null
  ) {
    const flows = monthlyDates(firstDue, count).map((date) => ({
      date,
      amount: installment,
    }));
    const cost = effectiveAnnualCost(released, fees, releaseDate, flows);
    const shown = cost === null ? null : roundHalfEven(cost * 10000) / 10000;
    const paid = fees + installment * count;
    results =
      shown === null ? (
        <Alert tone="warning">
          <AlertContent>
            <AlertDescription>{t("calc.credit.noSolution")}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Stack gap={5}>
          <ResultLead
            label={t("calc.credit.annual")}
            value={formatRate(shown, locale, { min: 2, max: 2 })}
            summary={t("calc.credit.summary", {
              paid: money.format(paid),
              released: money.format(released),
            })}
          />
          <ResultList
            results={[
              {
                label: t("calc.credit.monthly"),
                value: formatRate(annualToMonthly(shown), locale),
              },
              ...(terms.nominal === null
                ? []
                : [
                    {
                      label: t(terms.nominal),
                      value: formatRate(annualToMonthly(shown) * 12, locale, {
                        min: 2,
                        max: 2,
                      }),
                    },
                  ]),
              { label: t("calc.credit.paid"), value: money.format(paid) },
              {
                label: t("calc.credit.cost"),
                value: money.format(paid - released),
              },
            ]}
          />
        </Stack>
      );
    details = (
      <CalcTable
        long
        caption={t("calc.credit.flows")}
        headers={[
          t("calc.credit.col.number"),
          t("calc.credit.col.date"),
          t("calc.credit.col.days"),
          t("calc.credit.col.amount"),
        ]}
        rows={flows.map((f, i) => ({
          key: f.date,
          cells: [
            String(i + 1),
            formatDate(f.date, locale),
            String(daysBetween(releaseDate, f.date)),
            money.format(f.amount),
          ],
        }))}
      />
    );
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.credit.released")}
        hint={t("calc.credit.released.hint")}
        value={search.released}
        money={money}
        onChange={(v) => {
          set({ released: v });
        }}
      />
      <AmountField
        label={t("calc.credit.fees")}
        hint={t("calc.credit.fees.hint")}
        value={search.fees}
        money={money}
        onChange={(v) => {
          set({ fees: v });
        }}
      />
      <div className={styles.pair}>
        <CountField
          label={t("calc.credit.count")}
          unit={t("calc.unit.installments")}
          name="count"
          value={search.count ?? ""}
          onChange={(v) => {
            set({ count: v });
          }}
        />
        <AmountField
          label={t("calc.credit.installment")}
          value={search.installment}
          money={money}
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      </div>
      <div className={styles.pair}>
        <Field necessity="none">
          <FieldLabel>{t("calc.credit.releaseDate")}</FieldLabel>
          <DateInput
            name="releaseDate"
            value={releaseDate}
            shortcuts={false}
            onChange={(v) => {
              set({ releaseDate: v });
            }}
          />
        </Field>
        <Field necessity="none">
          <FieldLabel>{t("calc.credit.firstDue")}</FieldLabel>
          <DateInput
            name="firstDue"
            value={firstDue ?? monthlyDates(releaseDate, 2)[1] ?? releaseDate}
            shortcuts={false}
            onChange={(v) => {
              set({ firstDue: v });
            }}
          />
        </Field>
      </div>
    </>
  );

  return (
    <CalculatorFrame
      id="credit-cost"
      inputs={inputs}
      results={
        results === null ? null : (
          <Stack gap={6}>
            {results}
            {details}
          </Stack>
        )
      }
      method={method}
    />
  );
}
