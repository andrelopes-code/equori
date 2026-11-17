import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { ModelUse, UsageRow } from "@/features/setup/api";
import card from "@/features/setup/assistant/assistant-card.module.css";
import { catalogLabel } from "@/features/setup/model/catalog-label";
import { UseNote } from "@/features/setup/usage/use-note";
import styles from "@/features/setup/usage/use-route.module.css";
import { UseRoute } from "@/features/setup/usage/use-route";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface UseRowProps {
  use: ModelUse;
  rows: readonly UsageRow[];
  now: Date;
  onEdit: () => void;
}

// One use of a model (spec A5): its name and one note, the route it runs, and the edit of its
// order.
export function UseRow({ use, rows, now, onEdit }: UseRowProps) {
  const t = useT();

  return (
    <li className={cx(card.row, styles.row)}>
      <div className={styles.body}>
        <div className={styles.top}>
          <Text size="md" weight="medium" truncate className={styles.name}>
            {catalogLabel(t, `assistant.use.${use.id}`, use.id)}
          </Text>
          <UseNote use={use} rows={rows} now={now} />
        </div>

        <UseRoute use={use} rows={rows} now={now} />
      </div>

      <Button variant="ghost" tone="secondary" onClick={onEdit}>
        {t("assistant.use.edit")}
      </Button>
    </li>
  );
}
