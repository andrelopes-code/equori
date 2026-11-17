import { useId } from "react";
import type { CSSProperties } from "react";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/studio/color-controls.module.css";
import { presetColors } from "@/ui/card-face/studio/face-draft";
import { OptionTile } from "@/ui/card-face/studio/option-tile";
import { colorLabels } from "@/ui/card-face/studio/studio-labels";

interface ColorRackProps {
  color: string;
  onPick: (hex: string) => void;
}

export function ColorRack({ color, onPick }: ColorRackProps) {
  const t = useT();
  const group = useId();

  return (
    <div
      className={styles.rack}
      role="radiogroup"
      aria-label={t("cardFace.studio.color")}
    >
      {presetColors.map(({ key, hex }) => (
        <OptionTile
          key={key}
          variant="plastic"
          group={group}
          label={t(colorLabels[key])}
          checked={hex === color}
          style={{ "--card-face-color": hex } as CSSProperties}
          onSelect={() => {
            onPick(hex);
          }}
        />
      ))}
    </div>
  );
}
