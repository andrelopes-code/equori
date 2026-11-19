import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useComparableIndexList } from "@/features/calculators/indexer-comparison/use-comparison-data";
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
  const money = useCalculatorMoney();
  const list = useComparableIndexList(money?.currency ?? "");

  // The indexes are judged against the base currency, so both reads must answer (M4). A
  // comparison held while they load keeps the rows in place; a read paused offline holds the
  // row without marking the list busy.
  const held = list.pending || money === null;
  const busy = held && !list.paused;
  const comparable = list.indexes.length > 0 || held;
  const listed = calculators.filter(
    (c) => written.has(c.id) && (c.id !== "indexer-comparison" || comparable),
  );
  const noteKey = missingNoteKey(list.failed, comparable);
  const noteGroup = calculators.find(
    (c) => c.id === "indexer-comparison",
  )?.group;

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
          <div className={styles.groups} aria-busy={busy || undefined}>
            {calculatorGroups.map((group) => (
              <CalculatorGroup
                key={group}
                group={group}
                ids={listed.filter((c) => c.group === group).map((c) => c.id)}
                note={group === noteGroup && noteKey ? t(noteKey) : undefined}
              />
            ))}
          </div>
        </PageStack>
      </PageBody>
    </Page>
  );
}

// The line under Investir when Comparar indexadores is hidden.
function missingNoteKey(failed: boolean, comparable: boolean) {
  if (failed) return "calc.list.indexesFailed";
  if (comparable) return undefined;

  return "calc.list.indexesAbsent";
}
