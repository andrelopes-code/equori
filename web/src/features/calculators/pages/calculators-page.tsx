import { useQuery } from "@tanstack/react-query";

import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { useApi } from "@/api/api-context";
import { indexesQuery } from "@/features/calculators/api";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useComparableIndexes } from "@/features/calculators/indexer-comparison/use-comparison-data";
import {
  calculatorGroups,
  calculators,
  written,
} from "@/features/calculators/model/calculators";
import { CalculatorGroup } from "@/features/calculators/pages/calculator-group";
import styles from "@/features/calculators/pages/calculators-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { PageStack } from "@/ui/page-layout/page-stack";

// The written calculators by group, each by the question it answers (CR11-CR15).
export function CalculatorsPage() {
  const t = useT();
  const indexes = useQuery(indexesQuery(useApi()));
  const currency = useCalculatorMoney()?.currency ?? "";
  const comparable = useComparableIndexes(currency).length > 0;

  const listed = calculators.filter(
    (c) => written.has(c.id) && (c.id !== "indexer-comparison" || comparable),
  );
  const noteKey = missingNoteKey(indexes, comparable);

  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("calc.title")}</PageHeaderHeading>
              <PageHeaderSubheading>{t("calc.subtitle")}</PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <PageStack>
          <div className={styles.groups}>
            {calculatorGroups.map((group) => (
              <CalculatorGroup
                key={group}
                group={group}
                ids={listed.filter((c) => c.group === group).map((c) => c.id)}
                note={group === "invest" && noteKey ? t(noteKey) : undefined}
              />
            ))}
          </div>
        </PageStack>
      </PageBody>
    </Page>
  );
}

// The line under Investir when Comparar indexadores is hidden; none while the indexes load.
function missingNoteKey(
  indexes: { isError: boolean; isPending: boolean },
  comparable: boolean,
) {
  if (indexes.isError) return "calc.list.indexesFailed";
  if (indexes.isPending || comparable) return undefined;

  return "calc.list.indexesAbsent";
}
