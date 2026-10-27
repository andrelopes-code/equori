import styles from "@/features/setup/appearance-previews.module.css";
import type { Scheme } from "@/theme/scheme";

const layers: Record<Scheme, readonly Exclude<Scheme, "system">[]> = {
  light: ["light"],
  dark: ["dark"],
  "high-contrast": ["high-contrast"],
  system: ["light", "dark"],
};

// Families read: none draws a miniature of the application. The drawing is an SVG painted only
// through the tokens of the scheme it stands in, so the preview is the scheme and not a copy of
// its colours. System lays the dark drawing over the light one and shows each on one half.
export function SchemePreview({ scheme }: { scheme: Scheme }) {
  return (
    <span
      className={styles.scheme}
      data-split={scheme === "system" || undefined}
    >
      {layers[scheme].map((layer) => (
        <span
          key={layer}
          className={styles.layer}
          data-layer={layer}
          data-slotted-scheme={layer}
        >
          <svg viewBox="0 0 160 100" className={styles.drawing}>
            <rect className={styles.ground} width="160" height="100" />
            <rect className={styles.rail} width="34" height="100" />
            <circle className={styles.accent} cx="11" cy="12" r="4.5" />
            <rect
              className={styles.ink}
              x="19"
              y="10.5"
              width="10"
              height="3"
              rx="1.5"
            />
            <rect
              className={styles.pillOn}
              x="6"
              y="26"
              width="22"
              height="7"
              rx="3.5"
            />
            <rect
              className={styles.pill}
              x="6"
              y="37"
              width="22"
              height="7"
              rx="3.5"
            />
            <rect
              className={styles.pill}
              x="6"
              y="48"
              width="22"
              height="7"
              rx="3.5"
            />
            <rect
              className={styles.pill}
              x="6"
              y="59"
              width="22"
              height="7"
              rx="3.5"
            />
            <circle className={styles.seriesTwo} cx="11" cy="88" r="5" />
            <rect
              className={styles.ink}
              x="44"
              y="10"
              width="40"
              height="5"
              rx="2.5"
            />
            <rect
              className={styles.muted}
              x="44"
              y="19"
              width="26"
              height="3"
              rx="1.5"
            />
            <rect
              className={styles.action}
              x="128"
              y="8"
              width="24"
              height="9"
              rx="4.5"
            />
            <rect
              className={styles.card}
              x="44"
              y="29"
              width="108"
              height="41"
              rx="5"
            />
            <rect
              className={styles.muted}
              x="51"
              y="36"
              width="22"
              height="3"
              rx="1.5"
            />
            <rect
              className={styles.ink}
              x="51"
              y="43"
              width="38"
              height="7"
              rx="3.5"
            />
            <polygon
              className={styles.area}
              points="96,63 96,59 106,54 116,57 126,48 136,51 146,41 146,63"
            />
            <polyline
              className={styles.line}
              points="96,59 106,54 116,57 126,48 136,51 146,41"
            />
            <circle className={styles.seriesThree} cx="50" cy="79" r="3" />
            <rect
              className={styles.muted}
              x="57"
              y="77.5"
              width="40"
              height="3"
              rx="1.5"
            />
            <rect
              className={styles.ink}
              x="130"
              y="77.5"
              width="22"
              height="3"
              rx="1.5"
            />
            <circle className={styles.seriesFour} cx="50" cy="90" r="3" />
            <rect
              className={styles.muted}
              x="57"
              y="88.5"
              width="30"
              height="3"
              rx="1.5"
            />
            <rect
              className={styles.ink}
              x="134"
              y="88.5"
              width="18"
              height="3"
              rx="1.5"
            />
          </svg>
        </span>
      ))}
    </span>
  );
}
