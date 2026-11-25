import { Glyph } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type {
  ListRow,
  RowFlag,
} from "@/features/portfolio/contribution-plan/list/list-rows";
import styles from "@/features/portfolio/contribution-plan/list/plan-list.module.css";
import { rowText } from "@/features/portfolio/contribution-plan/list/row-text";
import { ShareOfContribution } from "@/features/portfolio/contribution-plan/list/share-of-contribution";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

type Plan = components["schemas"]["ContributionPlan"];

interface PlanRowProps {
  row: ListRow;
  view: Plan;
  // The contribution in minor units: the base of the share.
  base: number;
  open: boolean;
  onOpen: (row: ListRow) => void;
}

const flagKeys = {
  due: "contributionPlan.list.flagDue",
  released: "contributionPlan.list.flagReleased",
  warned: "contributionPlan.list.flagWarned",
  wouldWait: "contributionPlan.list.flagWouldWait",
} as const satisfies Record<RowFlag, string>;

// Build-own-element: an asset of the plan as one button that opens its panel. A table row is not one
// control, and a list item of the library holds no aligned columns.
export function PlanRow({ row, view, base, open, onOpen }: PlanRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale?.(m.currency) ?? 0);
  const cost = row.entry?.cost;
  const fraction =
    cost === undefined || base === 0 ? undefined : cost.amount / base;
  const text = rowText(row, view, {
    t,
    money,
    locale,
    hidden: fmt.hidden,
  });

  return (
    <li className={styles.item}>
      <button
        type="button"
        id={`plan-row-${row.key}`}
        className={styles.row}
        aria-expanded={open}
        onClick={() => {
          onOpen(row);
        }}
      >
        <span className={styles.square}>
          <GroupDot position={row.group} shape="square" />
        </span>

        <Text size="md" weight="medium" className={styles.code}>
          {row.name}
        </Text>

        <Text size="xs" tone="muted" className={styles.group}>
          {row.groupName ?? ""}
        </Text>

        <ShareOfContribution fraction={fraction} position={row.group} />

        <Text size="xs" tone="muted" className={styles.order}>
          {text}
        </Text>

        {cost !== undefined && (
          <Text size="md" weight="semibold" className={styles.total}>
            {money(cost)}
          </Text>
        )}

        {row.heldBy !== undefined && (
          <Text size="md" tone="muted" className={styles.total}>
            {t("contributionPlan.list.waits")}
          </Text>
        )}

        {row.flag !== undefined && (
          <Text
            size="xs"
            weight="medium"
            className={cx(styles.tail, styles.flag)}
          >
            {t(flagKeys[row.flag])}
          </Text>
        )}

        {row.flag === undefined && fraction !== undefined && (
          <Text size="xs" tone="muted" className={styles.tail}>
            {shareText(fraction, locale)}
          </Text>
        )}

        <span className={styles.chevron}>
          <Glyph name="chevron-right" />
        </span>
      </button>
    </li>
  );
}
