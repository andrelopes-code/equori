import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import { missingSentence } from "@/features/calculators/calculator-frame/missing-fields";
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
  missing: { balance: boolean; rate: boolean; term: boolean };
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
    const fields = [
      { label: t("calc.compound.live.balance"), missing: missing.balance },
      { label: t("calc.compound.rate"), missing: missing.rate },
      { label: t("calc.compound.live.term"), missing: missing.term },
    ].map((f) => ({ ...f, label: f.label.toLocaleLowerCase(tag) }));

    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={
          missingSentence(fields, t("calc.compound.income.what"), t, tag) ?? ""
        }
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
