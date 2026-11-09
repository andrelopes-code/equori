import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { Indicators } from "@/features/overview";
import { IndicatorAuditTable } from "@/features/reports/indicator-audit-table";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

export interface IndicatorAuditProps {
  report: Indicators;
}

// The definitions that the five charts of the old tab carried as notes.
const definitions: readonly (readonly [MessageKey, MessageKey])[] = [
  ["report.indicators.savings", "report.indicators.savingsNote"],
  ["report.indicators.reserve", "report.indicators.reserveNote"],
  ["report.indicators.committed", "report.indicators.committedNote"],
  ["report.indicators.debt", "report.indicators.debtNote"],
  ["report.indicators.liabilities", "report.indicators.liabilitiesNote"],
];

// Every figure of the payload month by month, for a reader who audits a number of the cards above,
// and the definitions of the ratios. It stays closed: no question of the tab needs it.
export function IndicatorAudit({ report }: IndicatorAuditProps) {
  const t = useT();

  return (
    <Collapsible variant="framed" level="3">
      <CollapsibleHeader>
        <CollapsibleTrigger>
          {t("report.indicators.audit.title")}
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <Stack gap={6}>
          <IndicatorAuditTable report={report} />

          <DescriptionList layout="stack" columns={2}>
            {definitions.map(([term, note]) => (
              <DescriptionListItem key={term}>
                <DescriptionListTerm>{t(term)}</DescriptionListTerm>
                <DescriptionListDescription>
                  {t(note)}
                </DescriptionListDescription>
              </DescriptionListItem>
            ))}
          </DescriptionList>

          <Text size="sm" tone="muted">
            {t("report.indicators.audit.basis")}
          </Text>
        </Stack>
      </CollapsiblePanel>
    </Collapsible>
  );
}
