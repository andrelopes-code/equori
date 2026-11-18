import { Button } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { useRef, useState } from "react";

import { HelpShot } from "@/features/help/figure/help-shot";
import { HelpIcon } from "@/features/help/icon/help-icon";
import { useHelpMedia } from "@/features/help/media/use-help-media";
import type {
  HelpFigure,
  HelpStep,
} from "@/features/help/model/parse-help-page";
import { HelpPlayer } from "@/features/help/steps/help-player";
import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface HelpVideoProps {
  video: HelpFigure;
  // The steps the video shows; the player lists them beside it.
  steps: readonly HelpStep[];
  // The capture the video waits behind.
  poster?: HelpFigure | undefined;
}

// The video of the steps waits behind a capture; pressed, it opens in a player that grows over
// the page and plays muted, with controls. It never starts alone and loads nothing before the
// press, and the steps are its text (help spec, HP6).
export function HelpVideo({ video, steps, poster }: HelpVideoProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const media = useHelpMedia().video(video.id);
  const [playing, setPlaying] = useState<string | null>(null);
  const frame = useRef<HTMLElement>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const watch = useRef<HTMLButtonElement>(null);

  if (media === undefined) return null;

  const seconds = numberFormatter(locale).format(media.seconds);

  const handlePlay = () => {
    const scheme = document.documentElement.getAttribute("data-slotted-scheme");

    setOrigin(frame.current?.getBoundingClientRect() ?? null);
    setPlaying(scheme === "light" ? media.light : media.dark);
  };

  // The focus returns to the button that opened the player (WCAG 2.4.3).
  const handleClose = () => {
    setPlaying(null);
    watch.current?.focus();
  };

  return (
    <figure className={[styles.figure, styles.clipFrame].join(" ")} ref={frame}>
      {poster !== undefined && <HelpShot figure={poster} marked={false} />}

      <span className={styles.clipPlay}>
        <Button
          ref={watch}
          variant="solid"
          tone="accent"
          start={
            <Icon size="sm">
              <HelpIcon name="play" />
            </Icon>
          }
          onClick={handlePlay}
        >
          {t("help.steps.watch", { seconds })}
        </Button>
      </span>

      {playing !== null && (
        <HelpPlayer
          src={playing}
          label={video.alt}
          steps={steps}
          origin={origin}
          onClose={handleClose}
        />
      )}
    </figure>
  );
}
