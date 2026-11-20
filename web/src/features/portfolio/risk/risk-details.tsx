import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/risk/risk-details.module.css";
import { RiskCorrelationsTable } from "@/features/portfolio/risk/risk-correlations-table";
import { RiskMeasuresTable } from "@/features/portfolio/risk/risk-measures-table";
import { useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskDetailsProps {
  report: RiskReport;
}

const terms = ["volatility", "drawdown", "share", "correlation"] as const;

// The terms behind the sentences, the measures of each class and how the classes move together,
// closed by default: what an investor who wants the method reads, and no one else needs to.
export function RiskDetails({ report }: RiskDetailsProps) {
  const t = useT();

  return (
    <Collapsible variant="plain" mount="lazy">
      <CollapsibleHeader>
        <CollapsibleTrigger>{t("portfolio.risk.details")}</CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <Stack gap={6}>
          <dl className={styles.terms}>
            {terms.map((term) => (
              <div key={term} className={styles.term}>
                <dt>
                  <Text size="sm" weight="medium">
                    {t(`portfolio.risk.term.${term}`)}
                  </Text>
                </dt>
                <dd>
                  <Text size="sm" tone="muted">
                    {t(`portfolio.risk.term.${term}.meaning`)}
                  </Text>
                </dd>
              </div>
            ))}
          </dl>

          <RiskMeasuresTable report={report} />
          <RiskCorrelationsTable report={report} />
        </Stack>
      </CollapsiblePanel>
    </Collapsible>
  );
}
