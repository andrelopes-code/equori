import { useEffect, useRef } from "react";

import { stepFrom } from "@/features/help/video/compose-frame";
import type { VideoTimeline } from "@/features/help/video/compose-frame";
import type { VideoClock } from "@/features/help/video/use-video-clock";

// The keys of the help video while its player is open: space plays or pauses and the arrows go
// from step to step. The listener is on the document, since the dialog holds the focus when it
// opens, outside the controls (owner, 2026-11-19). A button answers its own space and the slider
// its own arrows.
export function useVideoKeys(clock: VideoClock, video: VideoTimeline): void {
  const latest = useRef({ clock, video });

  useEffect(() => {
    latest.current = { clock, video };
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { clock: now, video: line } = latest.current;
      const target = event.target;
      const arrow = event.key === "ArrowLeft" || event.key === "ArrowRight";

      if (event.key === " " && !(target instanceof HTMLButtonElement)) {
        event.preventDefault();
        now.toggle();
      }

      if (arrow && !(target instanceof HTMLInputElement)) {
        event.preventDefault();
        now.seek(stepFrom(line, now.time, event.key === "ArrowRight" ? 1 : -1));
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
