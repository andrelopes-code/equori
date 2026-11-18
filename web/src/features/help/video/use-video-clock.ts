import { useEffect, useRef, useState } from "react";

export interface VideoClock {
  time: number;
  playing: boolean;
  toggle: () => void;
  seek: (time: number) => void;
}

// The second the video stands at, advanced by the frames of the browser while it plays. It
// starts once when `start` turns true, and stops at the end.
export function useVideoClock(duration: number, start: boolean): VideoClock {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const now = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (!start || started.current) return;

    started.current = true;
    setPlaying(true);
  }, [start]);

  useEffect(() => {
    if (!playing) return;

    let last: number | undefined;
    let frame = requestAnimationFrame(tick);

    function tick(at: number) {
      const next = Math.min(duration, now.current + (at - (last ?? at)) / 1000);

      last = at;
      now.current = next;
      setTime(next);
      if (next >= duration) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, duration]);

  const seek = (to: number) => {
    now.current = Math.max(0, Math.min(duration, to));
    setTime(now.current);
  };

  // A press at the end plays the video again from its start.
  const toggle = () => {
    if (!playing && now.current >= duration) seek(0);

    started.current = true;
    setPlaying(!playing);
  };

  return { time, playing, toggle, seek };
}
