import { Glyph } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";
import { Toggle } from "@slotted/react/toggle";
import { useState } from "react";

import styles from "@/features/portfolio/contribution-plan/editor/target-field.module.css";
import {
  formatPercent,
  parsePercent,
} from "@/features/portfolio/contribution-plan/editor/target-percent";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TargetFieldProps {
  name: string;
  // Basis points.
  value: number;
  locked: boolean;
  // True when every other row of the group is locked.
  disabled: boolean;
  onChange: (bp: number) => void;
  onLock: (locked: boolean) => void;
}

// Families read: text-field and toggle. A percent with one decimal is what the reader types; the
// plan stores basis points, so the conversion stands here. The lock is a mode that stays on.
export function TargetField({
  name,
  value,
  locked,
  disabled,
  onChange,
  onLock,
}: TargetFieldProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const [typed, setTyped] = useState<string | null>(null);

  function handleText(text: string) {
    setTyped(text);
    const bp = parsePercent(text);
    if (bp !== undefined) onChange(bp);
  }

  return (
    <div className={styles.field}>
      <Toggle
        size="sm"
        variant="ghost"
        pressed={locked}
        aria-label={t("contributionPlan.lock", { name })}
        icon={<Glyph name="lock" />}
        onPressedChange={onLock}
      />

      <TextField
        className={styles.text}
        size="sm"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`${t("contributionPlan.colTarget")}: ${name}`}
        end="%"
        disabled={disabled}
        value={typed ?? formatPercent(tag, value)}
        onChange={(event) => {
          handleText(event.target.value);
        }}
        onBlur={() => {
          setTyped(null);
        }}
      />
    </div>
  );
}
