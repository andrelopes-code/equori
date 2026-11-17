import { Text } from "@slotted/react/typography";

import { presetNames } from "@/features/planning/income-split/bucket-draft";
import type { PresetName } from "@/features/planning/income-split/bucket-draft";
import { BucketPresetChoice } from "@/features/planning/income-split/dialog/bucket-preset-choice";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketPresetsProps {
  onPreset: (name: PresetName) => void;
}

// The body of the dialog while the draft holds no bucket (dialog spec A252).
export function BucketPresets({ onPreset }: BucketPresetsProps) {
  const t = useT();

  return (
    <section className={styles.splitBlock}>
      <div className={styles.blockHead}>
        <Text size="sm" weight="medium">
          {t("buckets.presets.title")}
        </Text>
        <Text size="sm" tone="muted">
          {t("buckets.presets.hint")}
        </Text>
      </div>

      <div className={styles.presets}>
        {presetNames.map((name) => (
          <BucketPresetChoice
            key={name}
            name={name}
            onChoose={() => {
              onPreset(name);
            }}
          />
        ))}
      </div>
    </section>
  );
}
