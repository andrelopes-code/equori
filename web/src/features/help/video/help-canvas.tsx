import { Fullscreen, FullscreenContent } from "@slotted/react/fullscreen";
import { useRef } from "react";

import type { HelpVideoMedia } from "@/features/help/media/help-media";
import styles from "@/features/help/styles/help.module.css";
import { VIDEO_VIEW } from "@/features/help/video/compose-frame";
import { VIDEO_RATIO } from "@/features/help/video/draw-frame";
import { HelpVideoBar } from "@/features/help/video/help-video-bar";
import {
  useDrawFrame,
  useStills,
} from "@/features/help/video/use-video-canvas";
import { useVideoClock } from "@/features/help/video/use-video-clock";
import { useVideoKeys } from "@/features/help/video/use-video-keys";
import { useMediaQuery } from "@/ui/runtime/use-media-query";

interface HelpCanvasProps {
  video: HelpVideoMedia;
  // The name of the video: the alternative text the page gives it.
  label: string;
}

// Families read: media-viewer (files, not a timeline), fullscreen. The video of the steps drawn
// on a canvas at the size of the stills, reduced to the player by the page (ADR 037, 7). The
// first still stands as its poster until every still is decoded; this screen's form.
export function HelpCanvas({ video, label }: HelpCanvasProps) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  const stills = useStills(video.stills);
  const clock = useVideoClock(video.duration, stills !== null && !reduced);

  const canvas = useRef<HTMLCanvasElement>(null);

  useDrawFrame(canvas, stills, video, clock.time, reduced);
  useVideoKeys(clock, video);

  const ready = stills !== null;

  return (
    <Fullscreen className={styles.videoScreen}>
      <FullscreenContent className={styles.videoContent}>
        <div className={styles.videoPicture} onClick={clock.toggle}>
          <canvas
            ref={canvas}
            className={styles.videoCanvas}
            width={VIDEO_VIEW.width * VIDEO_RATIO}
            height={VIDEO_VIEW.height * VIDEO_RATIO}
            role="img"
            aria-label={label}
            data-ready={ready ? "" : undefined}
          />
          {!ready && (
            <img className={styles.videoPoster} src={video.stills[0]} alt="" />
          )}
        </div>

        <HelpVideoBar
          playing={clock.playing}
          time={clock.time}
          duration={video.duration}
          onToggle={clock.toggle}
          onSeek={clock.seek}
        />
      </FullscreenContent>
    </Fullscreen>
  );
}
