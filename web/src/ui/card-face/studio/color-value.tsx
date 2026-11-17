import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/studio/color-controls.module.css";
import { presetOf } from "@/ui/card-face/studio/face-draft";
import { colorLabels } from "@/ui/card-face/studio/studio-labels";

interface ColorValueProps {
  color: string;
  suggested: string;
}

const separator = " · ";

export function ColorValue({ color, suggested }: ColorValueProps) {
  const t = useT();
  const preset = presetOf(color);
  const name =
    preset === undefined ? t("cardFace.studio.custom") : t(colorLabels[preset]);
  const isSuggested = color.toLowerCase() === suggested.toLowerCase();

  return (
    <>
      <Text weight="semibold">{name}</Text>
      {isSuggested && (
        <Text tone="muted" className={styles.wide}>
          {separator}
          {t("cardFace.studio.suggested")}
        </Text>
      )}
      <code className={styles.code}>{color.toUpperCase()}</code>
    </>
  );
}
