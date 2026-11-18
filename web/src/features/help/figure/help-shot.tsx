import { useHelpMedia } from "@/features/help/media/use-help-media";
import type { HelpFigure } from "@/features/help/model/parse-help-page";
import styles from "@/features/help/styles/help.module.css";

interface HelpShotProps {
  figure: HelpFigure;
  // The number of the step the figure belongs to, drawn on its mark.
  number?: number;
  // A poster draws the capture alone.
  marked?: boolean;
}

// Families read: image (no mark over the picture). A capture of the app in the active scheme,
// with the place of a step outlined and the rest dimmed (help spec, HP4); this screen's form.
export function HelpShot({ figure, number, marked = true }: HelpShotProps) {
  const media = useHelpMedia().figure(figure.id);
  if (media === undefined) return null;

  const [start = 0, top = 0, width = 0, height = 0] = media.spot;

  return (
    <span className={styles.shot}>
      <img
        className={[styles.shotImage, styles.shotDark].join(" ")}
        src={media.dark}
        alt={figure.alt}
        width={640}
        height={400}
        loading="lazy"
      />
      <img
        className={[styles.shotImage, styles.shotLight].join(" ")}
        src={media.light}
        alt={figure.alt}
        width={640}
        height={400}
        loading="lazy"
      />
      {marked && (
        <span
          className={styles.spot}
          aria-hidden="true"
          style={{
            insetInlineStart: `${String(start)}%`,
            insetBlockStart: `${String(top)}%`,
            inlineSize: `${String(width)}%`,
            blockSize: `${String(height)}%`,
          }}
        >
          <span className={styles.spotNumber}>{number}</span>
        </span>
      )}
    </span>
  );
}
