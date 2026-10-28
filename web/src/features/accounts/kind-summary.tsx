import { Button } from "@slotted/react/button";
import { useField } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import { kindHint, kindTitle } from "@/features/accounts/account-kinds";
import type { Kind } from "@/features/accounts/account-kinds";
import styles from "@/features/accounts/kind-summary.module.css";
import { useT } from "@/i18n/i18n-provider";

// CP-04: the kind chosen in the first step, drawn as the chosen tile it was, with the way back
// to the tiles beside it. radio-group draws a set to choose from, not one choice already made;
// a bare line of text beside a ghost button read as neither a value nor a control.
export function KindSummary({
  kind,
  onChange,
}: {
  kind: Kind;
  // Absent once the account exists: its kind no longer changes.
  onChange?: (() => void) | undefined;
}) {
  const t = useT();
  const field = useField();
  return (
    <div
      role="group"
      aria-labelledby={field?.ids.label}
      aria-describedby={
        field?.describedBy === "" ? undefined : field?.describedBy
      }
      className={styles.summary}
      data-chosen={onChange !== undefined || undefined}
    >
      {onChange !== undefined && (
        <Icon size="sm" className={styles.mark}>
          <Glyph name="check" />
        </Icon>
      )}
      <div className={styles.text}>
        <Text size="sm" weight="semibold">
          {t(kindTitle[kind])}
        </Text>
        <Text size="sm" tone="muted">
          {t(kindHint[kind])}
        </Text>
      </div>
      {onChange !== undefined && (
        <Button size="sm" variant="outline" tone="secondary" onClick={onChange}>
          {t("accountForm.changeKind")}
        </Button>
      )}
    </div>
  );
}
