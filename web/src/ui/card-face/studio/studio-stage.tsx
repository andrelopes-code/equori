import type { CSSProperties } from "react";

import { CardFace } from "@/ui/card-face/card-face";
import type { CardFaceProps } from "@/ui/card-face/card-face";
import styles from "@/ui/card-face/studio/studio-stage.module.css";

interface StudioStageProps {
  face: CardFaceProps;
}

// Families read: card, aspect-ratio. The stage is a surface that takes the colour of the face on
// it: a glow behind, its shadow on the floor and a dotted backdrop.
export function StudioStage({ face }: StudioStageProps) {
  const style = { "--card-face-color": face.color } as CSSProperties;

  return (
    <div className={styles.stage} style={style}>
      <div
        className={styles.face}
        data-vertical={face.orientation === "vertical" ? "" : undefined}
      >
        <CardFace {...face} />
      </div>
    </div>
  );
}
