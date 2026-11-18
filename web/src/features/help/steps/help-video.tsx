import { helpFigure, helpVideo } from "@/features/help/media/help-media";
import type { HelpFigure } from "@/features/help/model/parse-help-page";
import styles from "@/features/help/styles/help.module.css";

interface HelpVideoProps {
  video: HelpFigure;
  // The capture shown until the reader starts the video.
  poster?: HelpFigure | undefined;
  // Set after the reader asked for the video by its own button: it starts, in this scheme alone.
  playing?: "dark" | "light";
}

// The steps as a muted video with controls; it loads nothing and never starts alone, and the
// steps beside it are its text (help spec, HP6).
export function HelpVideo({ video, poster, playing }: HelpVideoProps) {
  const media = helpVideo(video.id);
  const still = poster === undefined ? undefined : helpFigure(poster.id);
  if (media === undefined) return null;

  return (
    <span className={styles.shot}>
      {playing !== "light" && (
        <video
          className={
            playing === undefined
              ? [styles.shotImage, styles.shotDark].join(" ")
              : styles.shotImage
          }
          src={media.dark}
          poster={still?.dark}
          aria-label={video.alt}
          preload="none"
          autoPlay={playing !== undefined}
          controls
          muted
          playsInline
        />
      )}
      {playing !== "dark" && (
        <video
          className={
            playing === undefined
              ? [styles.shotImage, styles.shotLight].join(" ")
              : styles.shotImage
          }
          src={media.light}
          poster={still?.light}
          aria-label={video.alt}
          preload="none"
          autoPlay={playing !== undefined}
          controls
          muted
          playsInline
        />
      )}
    </span>
  );
}
