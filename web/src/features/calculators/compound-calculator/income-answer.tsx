import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import { emptySentence } from "@/features/calculators/compound-calculator/compound-answer";
import type { livingIncome } from "@/features/calculators/compound-calculator/compound-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface IncomeAnswerProps {
  // Null until the balance, the rate and the term are valid.
  rows: readonly IncomeRow[] | null;
  lasting: ReturnType<typeof livingIncome>;
  share: number;
  missing: { balance: boolean; rate: boolean; term: boolean; share: boolean };
  money: CalculatorMoney;
}

export function IncomeAnswer({
  rows,
  lasting,
  share,
  missing,
  money,
}: IncomeAnswerProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const lead = t("calc.compound.income.lead");
  const last = rows?.at(-1);

  if (rows === null) {
    const sentence = emptySentence({
      order: ["balance", "rate", "term", "share"],
      labels: {
        balance: t("calc.compound.live.balance"),
        rate: t("calc.compound.rate"),
        term: t("calc.compound.live.term"),
        share: t("calc.compound.live.share"),
      },
      missing,
      what: t("calc.compound.income.what"),
      t,
      tag,
    });

    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        // Nothing missing: the return does not beat the inflation.
        sentence={sentence === "" ? t("calc.compound.income.none") : sentence}
      />
    );
  }

  if (lasting === null || last === undefined)
    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={t("calc.compound.income.none")}
      />
    );

  return (
    <CalculatorAnswer
      lead={lead}
      figure={money.format(lasting.today)}
      sentence={t("calc.compound.income.sentence", {
        atEnd: money.format(lasting.atEnd),
      })}
      facts={[
        {
          term: t("calc.compound.rows.reinvest", {
            share: formatRate(share, tag),
          }),
          value: money.format(lasting.reinvested),
        },
        {
          term: t("calc.compound.rows.living", {
            share: formatRate(1 - share, tag),
          }),
          value: money.format(lasting.living),
        },
        {
          term: t("calc.compound.live.final"),
          value: money.format(last.closing),
        },
      ]}
    />
  );
}
