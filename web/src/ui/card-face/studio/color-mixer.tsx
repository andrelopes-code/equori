import { Button } from "@slotted/react/button";
import type { CSSProperties } from "react";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/studio/color-controls.module.css";
import { HexField } from "@/ui/card-face/studio/hex-field";
import { axes } from "@/ui/card-face/studio/mixer-axes";
import { MixerSlider } from "@/ui/card-face/studio/mixer-slider";
import { useMixer } from "@/ui/card-face/studio/use-mixer";

interface ColorMixerProps {
  color: string;
  canRestore: boolean;
  onColor: (hex: string) => void;
  onRestore: () => void;
}

export function ColorMixer({
  color,
  canRestore,
  onColor,
  onRestore,
}: ColorMixerProps) {
  const t = useT();
  const { mix, move } = useMixer(color, onColor);
  const style = { "--now": color } as CSSProperties;

  return (
    <div className={styles.mix} style={style}>
      {axes.map((spec) => (
        <MixerSlider key={spec.axis} spec={spec} mix={mix} onMove={move} />
      ))}

      <div className={styles.hexRow}>
        <HexField color={color} onColor={onColor} />

        <Button
          tone="secondary"
          variant="outline"
          disabled={!canRestore}
          onClick={onRestore}
        >
          {t("cardFace.studio.restore")}
        </Button>
      </div>
    </div>
  );
}
