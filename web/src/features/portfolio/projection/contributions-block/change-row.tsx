import { Button } from "@slotted/react/button";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import { formatMonthSlashYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface ChangeRowProps {
  change: components["schemas"]["ProjectionChange"];
  first: boolean;
  past: boolean;
  currency: string;
  scale: number;
  onEdit: () => void;
}

// PX8: the start of a change, its monthly amount and the action; a past change has no action.
export function ChangeRow({
  change,
  first,
  past,
  currency,
  scale,
  onEdit,
}: ChangeRowProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const month = formatMonthSlashYear(change.month.slice(0, 7), tag);
  const when = t(
    first
      ? "portfolio.projection.contributions.row.since"
      : "portfolio.projection.contributions.row.from",
    { month },
  );

  return (
    <li className={styles.stepRow}>
      <span className={styles.stepWhen}>{when}</span>

      <span className={styles.stepAmount}>
        {t("portfolio.projection.contributions.row.amount", {
          amount: fmt.money({ amount: change.amount, currency }, scale),
        })}
      </span>

      {!past && (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          aria-label={t("portfolio.projection.contributions.edit.named", {
            when,
          })}
          onClick={onEdit}
        >
          {t("portfolio.projection.contributions.edit")}
        </Button>
      )}
    </li>
  );
}
