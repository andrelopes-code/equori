import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { minAnnualDays } from "@/features/portfolio/model/annual-rate-days";
import type { YieldGroup } from "@/features/portfolio/model/yield-figures";
import { FlowsByMonthTable } from "@/features/portfolio/return/flows-by-month-table";
import { ReconciliationStrip } from "@/features/portfolio/return/reconciliation-strip";
import { YieldGroupList } from "@/features/portfolio/return/yield-group-list";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import styles from "@/ui/dialogs/detail-dialog.module.css";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnMethodLayerProps {
  report: ReturnReport;
  groups: YieldGroup[];
  // The calendar span of the period, both ends included; under 365 days the personal rate a year
  // is not listed; absent, it is (RE6).
  days?: number | undefined;
}

// The body of the return method layer (L3): the reconciliation, the groups of the yield and the
// flows by month, with the two rates and what sets them apart beside them.
export function ReturnMethodLayer({
  report,
  groups,
  days,
}: ReturnMethodLayerProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const personal =
    days !== undefined && days < minAnnualDays ? undefined : report.annual_bp;
  // RE4, RE6: a rate the report lacks or does not state has no row.
  const rates = (
    [
      [t("holdings.method.period"), report.period_bp],
      [t("holdings.method.personal"), personal],
    ] as const
  ).flatMap(([term, bp]) => (bp === undefined ? [] : [[term, bp] as const]));

  return (
    <Stack gap={4}>
      <ReconciliationStrip report={report} />

      <div className={styles.split}>
        <div className={styles.main}>
          <Stack gap={4}>
            {groups.map((group) => (
              <YieldGroupList key={group.key} group={group} />
            ))}

            <FlowsByMonthTable
              flows={report.flows}
              currency={report.opening.currency}
            />
          </Stack>
        </div>

        <div className={styles.aside}>
          <Stack gap={3}>
            <Text size="sm" weight="semibold">
              {t("holdings.method.rates")}
            </Text>

            <DescriptionList variant="ruled">
              {rates.map(([term, bp]) => (
                <DescriptionListItem key={term}>
                  <DescriptionListTerm>{term}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Text size="sm" align="end" numeric="tabular">
                      {formatBasisPoints(bp, tag)}
                    </Text>
                  </DescriptionListDescription>
                </DescriptionListItem>
              ))}
            </DescriptionList>

            <Text size="sm" tone="muted">
              {t("holdings.method.difference")}
            </Text>
          </Stack>
        </div>
      </div>
    </Stack>
  );
}
