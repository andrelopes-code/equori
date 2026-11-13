import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

import { ClassNameInput } from "@/features/portfolio/contribution-plan/editor/class-name-input";
import styles from "@/features/portfolio/contribution-plan/ideal/name-cell.module.css";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { useT } from "@/i18n/i18n-provider";

interface NameCellProps {
  name: string;
  position: number;
  // A member sits below its group, with no colour mark of its own.
  member?: boolean;
  expander?: { open: boolean; controls: string; onToggle: () => void };
  // Edit mode: the name is an input.
  onRename?: (name: string) => void;
}

// The first column of a row: the expander slot, the group colour and the name.
export function NameCell({
  name,
  position,
  member = false,
  expander,
  onRename,
}: NameCellProps) {
  const t = useT();

  return (
    <div className={[styles.name, member ? styles.member : ""].join(" ")}>
      {!member && (
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
                <Glyph
                  name={expander.open ? "chevron-down" : "chevron-right"}
                />
              </Icon>
            </IconButton>
          )}
        </span>
      )}

      {!member && <GroupDot position={position} />}

      {onRename === undefined ? (
        <span className={styles.label}>{name}</span>
      ) : (
        <ClassNameInput value={name} onChange={onRename} />
      )}
    </div>
  );
}
