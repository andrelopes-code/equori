import { CardFaceChip } from "@/ui/card-face/chip";
import styles from "@/ui/card-face/studio/finish-options.module.css";

export type FinishDrawingKind =
  | "gold"
  | "silver"
  | "horizontal"
  | "vertical"
  | "auto"
  | "plate"
  | "name"
  | "none";

interface FinishDrawingProps {
  kind: FinishDrawingKind;
}

// The drawing of one finish option: the chip in its metal, the card's outline in its direction,
// or the issuer's brand as a plate with a monogram, a plate, two lines of name or nothing.
export function FinishDrawing({ kind }: FinishDrawingProps) {
  if (kind === "gold" || kind === "silver") {
    return (
      <span className={styles.drawing}>
        <CardFaceChip tone={kind} />
      </span>
    );
  }

  if (kind === "horizontal" || kind === "vertical") {
    return (
      <span className={styles.drawing}>
        <span className={styles.outline} data-orientation={kind} />
      </span>
    );
  }

  return (
    <span className={styles.drawing}>
      <svg
        viewBox="0 0 44 30"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
      >
        {kind === "auto" && (
          <>
            <rect
              x="9"
              y="3"
              width="26"
              height="24"
              rx="6"
              fill="currentColor"
              fillOpacity=".14"
            />
            <circle cx="22" cy="15" r="5" fill="currentColor" stroke="none" />
          </>
        )}
        {kind === "plate" && (
          <>
            <rect x="2" y="5" width="40" height="20" rx="5" strokeWidth="1.5" />
            <rect
              x="9"
              y="12"
              width="26"
              height="6"
              rx="3"
              fill="currentColor"
              stroke="none"
            />
          </>
        )}
        {kind === "name" && (
          <path d="M6 11h32M6 19h20" strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === "none" && (
          <rect
            x="3"
            y="5"
            width="38"
            height="20"
            rx="5"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}
      </svg>
    </span>
  );
}
