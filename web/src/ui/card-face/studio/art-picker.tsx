import { useId } from "react";

import { useT } from "@/i18n/i18n-provider";
import { ArtThumbnail } from "@/ui/card-face/studio/art-thumbnail";
import styles from "@/ui/card-face/studio/finish-options.module.css";
import { OptionTile } from "@/ui/card-face/studio/option-tile";
import { artOptions } from "@/ui/card-face/studio/studio-labels";

interface ArtPickerProps {
  art: string | null;
  color: string;
  chip: "gold" | "silver";
  onPick: (art: string) => void;
}

export function ArtPicker({ art, color, chip, onPick }: ArtPickerProps) {
  const t = useT();
  const group = useId();

  return (
    <div
      className={styles.thumbs}
      role="radiogroup"
      aria-label={t("cardFace.studio.art")}
    >
      {artOptions.map(({ key, label }) => (
        <OptionTile
          key={key}
          variant="thumb"
          group={group}
          label={t(label)}
          checked={(art ?? "plain") === key}
          onSelect={() => {
            onPick(key);
          }}
        >
          <ArtThumbnail art={key} color={color} chip={chip} />
        </OptionTile>
      ))}
    </div>
  );
}
