import media from "@/features/help/media/media.json";

export interface HelpFigureMedia {
  dark: string;
  light: string;
  // The place the figure marks, in percent of the capture: start, top, width, height.
  spot: readonly number[];
}

export interface HelpVideoMedia {
  dark: string;
  light: string;
  seconds: number;
}

interface FigureEntry {
  capture: string;
  spot: number[];
}

// The URL of each file; the browser fetches a capture or a video when its element asks for it.
const files = import.meta.glob<string>("./*.{png,webm}", {
  query: "?url",
  import: "default",
  eager: true,
});

const figures: Record<string, FigureEntry | undefined> = media.figures;
const videos: Record<string, { seconds: number } | undefined> = media.videos;

// The captures of a figure a page names, in both schemes, and its mark (help spec, HP3).
export function helpFigure(id: string): HelpFigureMedia | undefined {
  const entry = figures[id];
  if (entry === undefined) return undefined;

  const dark = files[`./${entry.capture}.dark.png`];
  const light = files[`./${entry.capture}.light.png`];
  if (dark === undefined || light === undefined) return undefined;

  return { dark, light, spot: entry.spot };
}

export function helpVideo(id: string): HelpVideoMedia | undefined {
  const entry = videos[id];
  const dark = files[`./${id}.dark.webm`];
  const light = files[`./${id}.light.webm`];
  if (entry === undefined || dark === undefined || light === undefined) {
    return undefined;
  }

  return { dark, light, seconds: entry.seconds };
}
