import { Checkbox } from "@slotted/react/checkbox";
import { Slider } from "@slotted/react/slider";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import {
  formatPercent,
  parsePercent,
} from "@/features/portfolio/contribution-plan/target-percent";
import styles from "@/features/portfolio/contribution-plan/target-input.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TargetInputProps {
  name: string;
  // Basis points.
  value: number;
  locked: boolean;
  // True when every other row of the group is locked.
  disabled: boolean;
  onChange: (bp: number) => void;
  onLock: (locked: boolean) => void;
}

// Families read: text-field and slider. A percent with one decimal is what the reader types and
// drags; the plan stores basis points, so the conversion stands here.
export function TargetInput({
  name,
  value,
  locked,
  disabled,
  onChange,
  onLock,
}: TargetInputProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const [typed, setTyped] = useState<string | null>(null);

  const label = `${t("contributionPlan.colTarget")}: ${name}`;

  function handleText(text: string) {
    setTyped(text);
    const bp = parsePercent(text);
    if (bp !== undefined) onChange(bp);
  }

  function handleSlider(next: number | readonly number[]) {
    if (typeof next === "number") onChange(Math.round(next * 10) * 10);
  }

  return (
    <div className={styles.target}>
      <Checkbox
        checked={locked}
        aria-label={t("contributionPlan.lock", { name })}
        onCheckedChange={onLock}
      />

      <TextField
        className={styles.text}
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
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

      <Slider
        className={styles.slider}
        aria-label={label}
        disabled={disabled}
        value={value / 100}
        min={0}
        max={100}
        step={0.1}
        onValueChange={handleSlider}
      />
    </div>
  );
}
