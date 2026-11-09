import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { ReturnView } from "@/features/portfolio/return-view";
import { yieldGroups, yieldNotes } from "@/features/portfolio/yield-figures";
import { useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The days of the window, the 365 that end today.
const WINDOW_DAYS = 365;

interface AccountYieldSectionProps {
  accountId: string;
}

// The yield of an account over the last 12 months, as a titled section of its page (amendment
// A208 R17, RC1): the verdict, the comparisons beside the money panel, the notes and the details.
export function AccountYieldSection({ accountId }: AccountYieldSectionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const from = shiftDate(today, 1 - WINDOW_DAYS);
  const report = useAccountYield(accountId, from, today);

  const scale = useScale();
  const format = useMoneyFormat();

  const groups =
    report === undefined
      ? []
      : yieldGroups(report, t, tag, { from, to: today, days: WINDOW_DAYS });
  const notes =
    report === undefined
      ? []
      : yieldNotes(report, t, (m) => format.money(m, scale?.(m.currency) ?? 0));
  if (report === undefined || (groups.length === 0 && notes.length === 0)) {
    return null;
  }

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.yield.figure")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <ReturnView
          report={report}
          subject="account"
          window={{ from, to: today, days: WINDOW_DAYS }}
        />
      </SectionBody>
    </Section>
  );
}
