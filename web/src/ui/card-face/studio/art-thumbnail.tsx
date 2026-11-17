import type { CSSProperties } from "react";

import { CardFaceArt } from "@/ui/card-face/art";
import faceStyles from "@/ui/card-face/card-face.module.css";
import { CardFaceChip } from "@/ui/card-face/chip";
import { darkInk, inkOf, lightInk } from "@/ui/card-face/ink";
import styles from "@/ui/card-face/studio/art-thumbnail.module.css";

interface ArtThumbnailProps {
  art: string;
  color: string;
  chip: "gold" | "silver";
}

// Families read: card, aspect-ratio. The thumbnail is the plastic itself at a small size, drawn
// from the face's own classes: art, foil and chip, without the text, the brand or the network.
export function ArtThumbnail({ art, color, chip }: ArtThumbnailProps) {
  const { ink } = inkOf(color);
  const style = {
    "--card-face-color": color,
    "--card-face-ink": ink === "light" ? lightInk : darkInk,
  } as CSSProperties;

  return (
    <span className={styles.thumb} data-part="preview" aria-hidden="true">
      <span
        className={faceStyles.face}
        data-art={art}
        data-ink={ink}
        style={style}
      >
        <span className={faceStyles.art} data-part="art">
          <CardFaceArt art={art} />
        </span>
        <span className={faceStyles.foil} />
        <span className={faceStyles.foil2} />
        <CardFaceChip tone={chip} />
      </span>
    </span>
  );
}
