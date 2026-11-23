import { TableColumnHeader, TableHead, TableRow } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/portfolio/contribution-plan/month/purchase-row.module.css";
import { useT } from "@/i18n/i18n-provider";

interface PurchaseTableHeadProps {
  // Whether the list holds a company: the column of the change of its profit.
  withProfit: boolean;
}

// The column names of the purchase list; the asset and the group name themselves.
export function PurchaseTableHead({ withProfit }: PurchaseTableHeadProps) {
  const t = useT();

  return (
    <TableHead>
      <TableRow>
        <TableColumnHeader>
          <VisuallyHidden>{t("contributionPlan.colAsset")}</VisuallyHidden>
        </TableColumnHeader>

        <TableColumnHeader>
          <VisuallyHidden>{t("contributionPlan.colGroup")}</VisuallyHidden>
        </TableColumnHeader>

        {withProfit && (
          <TableColumnHeader className={styles.wide}>
            <Text size="xs" tone="muted" weight="medium">
              {t("contributionPlan.colProfit")}
            </Text>
          </TableColumnHeader>
        )}

        <TableColumnHeader align="end">
          <Text size="xs" tone="muted" weight="medium">
            {t("contributionPlan.colOrder")}
          </Text>
        </TableColumnHeader>

        <TableColumnHeader numeric>
          <Text size="xs" tone="muted" weight="medium">
            {t("contributionPlan.colTotal")}
          </Text>
        </TableColumnHeader>

        <TableColumnHeader numeric className={styles.wide}>
          <Text size="xs" tone="muted" weight="medium">
            {t("contributionPlan.colShare")}
          </Text>
        </TableColumnHeader>
      </TableRow>
    </TableHead>
  );
}
