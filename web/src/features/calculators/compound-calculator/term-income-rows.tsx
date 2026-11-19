import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import { termIncome } from "@/features/calculators/compound-calculator/compound-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { REINVESTED_SHARE } from "@/features/calculators/model/compound-math";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TermIncomeRowsProps {
  final: number;
  j: number;
  months: number;
  inflation: number | null;
  withdraw: number | null;
  money: CalculatorMoney;
}

// The monthly income the final amount pays after the term, as labelled rows.
export function TermIncomeRows({
  final,
  j,
  months,
  inflation,
  withdraw,
  money,
}: TermIncomeRowsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { lasting, spending } = termIncome({
    final,
    j,
    inflation,
    months,
    withdraw,
  });
  const today = inflation === null ? undefined : t("calc.compound.rows.today");
  const note = (text: string | undefined) =>
    text === undefined ? {} : { note: text };
  const living = formatRate(1 - REINVESTED_SHARE, tag);
  const reinvested = formatRate(REINVESTED_SHARE, tag);

  const rows = [
    ...(lasting === null
      ? []
      : [
          {
            term: t("calc.compound.rows.lasting"),
            ...note(today),
            value: money.format(lasting.today),
          },
          ...(inflation === null
            ? []
            : [
                {
                  term: t("calc.compound.rows.same"),
                  note: t("calc.compound.rows.atEnd"),
                  value: money.format(lasting.atEnd),
                },
              ]),
          {
            term: t("calc.compound.rows.reinvest", { share: reinvested }),
            ...note(today),
            value: money.format(lasting.reinvested),
          },
          {
            term: t("calc.compound.rows.living", { share: living }),
            ...note(today),
            value: money.format(lasting.living),
          },
        ]),
    ...(spending === null
      ? []
      : [
          {
            term: t("calc.compound.income.spending"),
            ...note(today),
            value: money.format(spending),
          },
        ]),
  ];

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.compound.rows.title")}</SectionHeading>
          <SectionDescription>
            {t("calc.compound.rows.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        {lasting === null && (
          <Alert tone="warning">
            <AlertContent>
              <AlertDescription>
                {t("calc.compound.income.none")}
              </AlertDescription>
            </AlertContent>
          </Alert>
        )}

        <FactRows rows={rows} />
      </SectionBody>
    </Section>
  );
}
