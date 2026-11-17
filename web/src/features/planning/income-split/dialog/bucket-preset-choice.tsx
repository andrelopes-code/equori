import { Text } from "@slotted/react/typography";

import { presets } from "@/features/planning/income-split/bucket-draft";
import type { PresetName } from "@/features/planning/income-split/bucket-draft";
import { SplitBarStrip } from "@/features/planning/income-split/dialog/split-bar-strip";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketPresetChoiceProps {
  name: PresetName;
  onChoose: () => void;
}

// One preset of A232 as a choice (dialog spec A252): its name, its bar and its buckets. Built
// here: no family draws a choice with a bar inside it.
export function BucketPresetChoice({
  name,
  onChoose,
}: BucketPresetChoiceProps) {
  const t = useT();

  const parts = presets[name];
  const names = parts.map((p) => t(p.name)).join(", ");
  const detail =
    name === "scratch"
      ? t("buckets.preset.scratch.detail")
      : t("buckets.preset.detail", { count: String(parts.length), names });
  const bar = {
    segments: parts.map((p, i) => ({
      key: p.name,
      number: i + 1,
      bp: p.share,
    })),
    rest: 0,
  };

  return (
    <button type="button" className={styles.preset} onClick={onChoose}>
      <Text size="sm" weight="medium">
        {t(`buckets.preset.${name}`)}
      </Text>
      <SplitBarStrip bar={bar} label={names} mini />
      <Text size="xs" tone="muted" className={styles.presetDetail}>
        {detail}
      </Text>
    </button>
  );
}
