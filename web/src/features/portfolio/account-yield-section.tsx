import { Grid } from "@slotted/react/grid";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { indexName } from "@/features/calculators";
import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldGroups } from "@/features/portfolio/yield-figures";
import { YieldGroupList } from "@/features/portfolio/yield-group-list";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface AccountYieldSectionProps {
  accountId: string;
}

// The yield of an account over the last 12 months, as a titled section of its page (amendment
// A208 R17): what the profile means, then one group per period, the comparison with the index
// and the return net of inflation, side by side where the page is wide enough.
export function AccountYieldSection({ accountId }: AccountYieldSectionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const report = useAccountYield(accountId, shiftDate(today, -364), today);

  const groups = report === undefined ? [] : yieldGroups(report, t, tag);
  if (report === undefined || groups.length === 0) return null;

  const index = report.benchmark && indexName(report.benchmark.index);

  return (
    <Section ground="surface" size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.yield.figure")}</SectionHeading>
          {index !== undefined && (
            <SectionDescription>
              {t(`portfolio.yield.profile.${report.profile}`, { index })}
            </SectionDescription>
          )}
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <Grid minItemWidth="md" gap={8}>
          {groups.map((group) => (
            <YieldGroupList key={group.key} group={group} />
          ))}
        </Grid>
      </SectionBody>
    </Section>
  );
}
