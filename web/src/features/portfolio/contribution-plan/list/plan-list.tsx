import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type {
  ListRow,
  ListSections,
} from "@/features/portfolio/contribution-plan/list/list-rows";
import styles from "@/features/portfolio/contribution-plan/list/plan-list.module.css";
import { PlanListGroup } from "@/features/portfolio/contribution-plan/list/plan-list-group";
import { PlanLeftoverRow } from "@/features/portfolio/contribution-plan/list/plan-leftover-row";
import { PlanRow } from "@/features/portfolio/contribution-plan/list/plan-row";
import { copyText } from "@/features/portfolio/contribution-plan/model/copy-text";
import {
  contributionOf,
  positive,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
import { CopyListButton } from "@/features/portfolio/contribution-plan/month/copy-list-button";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Plan = components["schemas"]["ContributionPlan"];

interface PlanListProps {
  view: Plan;
  sections: ListSections;
  openKey: string | undefined;
  onOpen: (row: ListRow) => void;
}

// Every asset of the plan: what to buy, what waits and what receives nothing (spec, Purchase list).
export function PlanList({ view, sections, openKey, onOpen }: PlanListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const { buy, wait, none, split } = sections;
  const entries = buy.flatMap((row) =>
    row.entry === undefined ? [] : [row.entry],
  );
  const leftover = positive(view.leftover) ? view.leftover : undefined;
  const base = contributionOf(entries, leftover).amount;
  const text = copyText(entries, leftover, {
    t,
    locale,
    money: (m) => fmt.money(m, scale?.(m.currency) ?? 0),
  });
  const buyTitle = t(
    split ? "contributionPlan.list.buy" : "contributionPlan.list.assets",
  );
  const groups = [
    { key: "wait", title: t("contributionPlan.list.waiting"), rows: wait },
    { key: "none", title: t("contributionPlan.list.none"), rows: none },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className={styles.list}>
      {(buy.length > 0 || leftover !== undefined) && (
        <>
          <div className={styles.head}>
            <Text size="sm" weight="semibold" tone="muted">
              {buyTitle}
            </Text>

            {entries.length > 0 && (
              <CopyListButton text={text} disabled={fmt.hidden} />
            )}
          </div>

          <ul className={styles.rows} aria-label={buyTitle}>
            {buy.map((row) => (
              <PlanRow
                key={row.key}
                row={row}
                view={view}
                base={base}
                open={row.key === openKey}
                onOpen={onOpen}
              />
            ))}

            {leftover !== undefined && (
              <PlanLeftoverRow amount={leftover} base={base} />
            )}
          </ul>
        </>
      )}

      {groups.map((group) => (
        <PlanListGroup
          key={group.key}
          title={group.title}
          rows={group.rows}
          view={view}
          base={base}
          openKey={openKey}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
