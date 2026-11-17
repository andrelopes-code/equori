import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { inkOf } from "@/ui/card-face/ink";
import { presetOf } from "@/ui/card-face/studio/face-draft";
import { artOptions, colorLabels } from "@/ui/card-face/studio/studio-labels";
import styles from "@/ui/card-face/studio/studio-plate.module.css";

interface StudioPlateProps {
  color: string;
  art: string | null;
}

// "AA" is the name of the WCAG level, not a text of the interface.
const level = "AA";
const levelRatio = 4.5;
const ratioSuffix = ":1";

export function StudioPlate({ color, art }: StudioPlateProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const preset = presetOf(color);
  const colorName =
    preset === undefined ? t("cardFace.studio.custom") : t(colorLabels[preset]);
  const artLabel = artOptions.find(({ key }) => key === (art ?? "plain"));
  const { ink, ratio } = inkOf(color);
  const inkName =
    ink === "light"
      ? t("cardFace.studio.ink.light")
      : t("cardFace.studio.ink.dark");
  const formatted = numberFormatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);

  return (
    <div className={styles.plate}>
      <div className={styles.cell}>
        <Text size="xs" tone="muted" className={styles.label}>
          {t("cardFace.studio.color")}
        </Text>
        <Text weight="semibold" truncate>
          {colorName}
        </Text>
      </div>

      <div className={styles.cell}>
        <Text size="xs" tone="muted" className={styles.label}>
          {t("cardFace.studio.art")}
        </Text>
        <Text weight="semibold" truncate>
          {t(artLabel?.label ?? "cardFace.art.plain")}
        </Text>
      </div>

      <div className={styles.cell}>
        <Text size="xs" tone="muted" className={styles.label}>
          {t("cardFace.studio.ink")}
        </Text>
        <Text weight="semibold" truncate>
          {inkName}
        </Text>
      </div>

      <div className={styles.cell}>
        <Text size="xs" tone="muted" className={styles.label}>
          {t("cardFace.studio.contrast")}
        </Text>
        <Text weight="semibold">
          {formatted}
          {ratioSuffix}
          {ratio >= levelRatio && <span className={styles.level}>{level}</span>}
        </Text>
      </div>
    </div>
  );
}
