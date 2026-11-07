import { Grid } from "@slotted/react/grid";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { indexName } from "@/features/calculators";
import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldGroups, yieldNotes } from "@/features/portfolio/yield-figures";
import { YieldGroupList } from "@/features/portfolio/yield-group-list";
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
// A208 R17): one group per period, the comparison with the index and the return net of inflation,
// side by side where the page is wide enough, then what the profile means and the notes.
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

  const index = report.benchmark && indexName(report.benchmark.index);

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.yield.figure")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <Stack gap={4}>
          {groups.length > 0 && (
            <Grid minItemWidth="md" gap={8}>
              {groups.map((group) => (
                <YieldGroupList key={group.key} group={group} />
              ))}
            </Grid>
          )}

          {index !== undefined && (
            <Text size="sm" tone="muted">
              {t(`portfolio.yield.profile.${report.profile}`, { index })}
            </Text>
          )}

          {notes.map((note) => (
            <Text key={note} size="sm" tone="muted">
              {note}
            </Text>
          ))}
        </Stack>
      </SectionBody>
    </Section>
  );
}
