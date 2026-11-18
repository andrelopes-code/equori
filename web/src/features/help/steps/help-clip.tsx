import { Button } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { useState } from "react";

import { HelpShot } from "@/features/help/figure/help-shot";
import { HelpIcon } from "@/features/help/icon/help-icon";
import { helpVideo } from "@/features/help/media/help-media";
import type { HelpFigure } from "@/features/help/model/parse-help-page";
import { HelpVideo } from "@/features/help/steps/help-video";
import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface HelpClipProps {
  video: HelpFigure;
  poster?: HelpFigure | undefined;
}

// The video above the steps on a narrow page: it waits behind a capture until the reader asks.
export function HelpClip({ video, poster }: HelpClipProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const [playing, setPlaying] = useState<"dark" | "light" | null>(null);

  const media = helpVideo(video.id);
  if (media === undefined) return null;

  const seconds = numberFormatter(locale, {}).format(media.seconds);

  const handlePlay = () => {
    const scheme = document.documentElement.getAttribute("data-slotted-scheme");

    setPlaying(scheme === "light" ? "light" : "dark");
  };

  return (
    <div className={styles.clip}>
      <figure className={styles.figure}>
        {playing !== null && <HelpVideo video={video} playing={playing} />}

        {playing === null && poster !== undefined && (
          <HelpShot figure={poster} marked={false} />
        )}
        {playing === null && (
          <span className={styles.clipPlay}>
            <Button
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
        )}
      </figure>
    </div>
  );
}
