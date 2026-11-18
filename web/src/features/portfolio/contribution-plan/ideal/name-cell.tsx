import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/ideal/name-cell.module.css";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { useT } from "@/i18n/i18n-provider";

interface NameCellProps {
  name: string;
  position: number;
  expander?: { open: boolean; controls: string; onToggle: () => void };
  // The goal that holds the asset; the row carries its tag (CN20).
  reserved?: string | undefined;
}

// The first column of a row: the expander slot, the group colour and the name.
export function NameCell({
  name,
  position,
  expander,
  reserved,
}: NameCellProps) {
  const t = useT();

  return (
    <div className={styles.name}>
      <span className={styles.slot}>
        {expander !== undefined && (
          <IconButton
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("contributionPlan.showAssets", { name })}
            aria-expanded={expander.open}
            aria-controls={expander.controls}
            onClick={expander.onToggle}
          >
            <Icon>
              <Glyph name={expander.open ? "chevron-down" : "chevron-right"} />
            </Icon>
          </IconButton>
        )}
      </span>

      <GroupDot position={position} />

      <Text size="sm" className={styles.label}>
        {name}
      </Text>

      {reserved !== undefined && (
        <Tag size="sm">
          {t("contributionPlan.reservedFor", { goal: reserved })}
        </Tag>
      )}
    </div>
  );
}
