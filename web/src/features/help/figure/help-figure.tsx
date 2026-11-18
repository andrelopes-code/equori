import { Text } from "@slotted/react/typography";

import { HelpEnlarge } from "@/features/help/figure/help-enlarge";
import { HelpShot } from "@/features/help/figure/help-shot";
import { helpFigure } from "@/features/help/media/help-media";
import type { HelpFigure as Figure } from "@/features/help/model/parse-help-page";
import styles from "@/features/help/styles/help.module.css";

interface HelpFigureProps {
  figure: Figure;
}

// A figure in the text: the capture, its caption and the way to see it larger.
export function HelpFigure({ figure }: HelpFigureProps) {
  const media = helpFigure(figure.id);
  if (media === undefined) return null;

  return (
    <figure className={[styles.figure, styles.inlineFigure].join(" ")}>
      <HelpShot figure={figure} />

      <figcaption className={styles.caption}>
        <Text size="sm" tone="muted" render={(props) => <span {...props} />}>
          {figure.caption}
        </Text>
        <HelpEnlarge
          dark={media.dark}
          light={media.light}
          name={figure.alt}
          type="image/png"
        />
      </figcaption>
    </figure>
  );
}
