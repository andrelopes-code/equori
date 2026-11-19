import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { ChoiceRows } from "@/features/calculators/calculator-frame/choice-rows";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { prepay } from "@/features/calculators/financing-calculator/annuity";
import { prepayChoices } from "@/features/calculators/financing-calculator/financing-answer";
import { maxMonths } from "@/features/calculators/financing-calculator/financing-input";
import { systemNames } from "@/features/calculators/financing-calculator/financing-region";
import {
  readInt,
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/financing-calculator/address-keys";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface FinancingPrepayProps {
  loan: { amount: number; rate: number; months: number };
  money: CalculatorMoney;
}

// What an extra payment saves; null while its month and amount are not both entered.
export function FinancingPrepay({ loan, money }: FinancingPrepayProps) {
  const t = useT();
  const { locale } = useAppLocaleState();
  const [search] = useCalculatorSearch(addressKeys);
  const names = systemNames(locale.region);

  const month = readInt(search.prepayMonth, 1, maxMonths);
  const extra = readMinor(search.prepayAmount);
  if (month === null || extra === null) return null;

  const input = { ...loan, month, extra };
  const choices = prepayChoices(input);
  const change = prepay(loan.amount, loan.rate, loan.months, month, extra);
  if (choices === null || change === null)
    return (
      <FormNotice tone="warning" hideIcon>
        {t("calc.financing.prepay.invalid")}
      </FormNotice>
    );

  const saved = (name: string, effect: string, amount: number) =>
    `${name}: ${effect}, ${t("calc.choice.saved")} ${money.format(amount)}`;
  const termName = t("calc.financing.prepay.term");
  const lowerName = t("calc.financing.prepay.lower");
  const termEffect = t("calc.financing.prepay.termEffect", {
    months: String(choices.keepInstallment.months),
    fewer: String(choices.keepInstallment.fewer),
  });
  const lowerEffect = t("calc.financing.prepay.lowerEffect", {
    installment: money.format(choices.keepTerm.installment),
  });

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.financing.prepay.title")}</SectionHeading>
          <SectionDescription>
            {t("calc.financing.prepay.summary", {
              amount: money.format(extra),
              month: String(month),
              priceName: t(names.price),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <ChoiceRows
          head={[
            t("calc.choice.option"),
            t("calc.choice.effect"),
            t("calc.choice.saved"),
          ]}
          rows={[
            {
              name: termName,
              effect: termEffect,
              saved: choices.keepInstallment.saved,
              savedText: money.format(choices.keepInstallment.saved),
              label: saved(termName, termEffect, choices.keepInstallment.saved),
            },
            {
              name: lowerName,
              effect: lowerEffect,
              saved: choices.keepTerm.saved,
              savedText: money.format(choices.keepTerm.saved),
              label: saved(lowerName, lowerEffect, choices.keepTerm.saved),
            },
          ]}
          note={t("calc.financing.prepay.note", {
            balance: money.format(change.balance),
            without: money.format(change.without.interest),
          })}
        />
      </SectionBody>
    </Section>
  );
}
