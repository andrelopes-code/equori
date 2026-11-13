import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import styles from "@/features/portfolio/contribution-plan/editor/percent-field.module.css";
import {
  formatPercent,
  parsePercent,
} from "@/features/portfolio/contribution-plan/editor/target-percent";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface PercentFieldProps {
  name: string;
  // Basis points.
  value: number;
  // True when every other row of the group is locked.
  disabled: boolean;
  onChange: (bp: number) => void;
}

const stepBp = 100;
const wholeBp = 10000;

// Families read: text-field and button. A percent with one decimal is what the reader types; the
// plan stores basis points, so the conversion stands here. The buttons move it by one percent.
export function PercentField({
  name,
  value,
  disabled,
  onChange,
}: PercentFieldProps) {
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
      <IconButton
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-label={t("contributionPlan.decrease", { name })}
        disabled={disabled || value <= 0}
        onClick={() => {
          onChange(value - stepBp);
        }}
      >
        <Icon>
          <Glyph name="minus" />
        </Icon>
      </IconButton>

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

      <IconButton
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-label={t("contributionPlan.increase", { name })}
        disabled={disabled || value >= wholeBp}
        onClick={() => {
          onChange(value + stepBp);
        }}
      >
        <Icon>
          <Glyph name="plus" />
        </Icon>
      </IconButton>
    </div>
  );
}
