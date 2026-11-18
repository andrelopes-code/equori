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

type Marks = Partial<Record<string, { spot: number[] }>>;

// The language whose captures stand in for a language without its own.
const FALLBACK = "pt";

// The URL of each file; the browser fetches a capture or a video when its element asks for it.
// Every file and media.json are written by tools/help-media (docs/contributing/help-media.md).
const files = import.meta.glob<string>("./*.{png,webm}", {
  query: "?url",
  import: "default",
  eager: true,
});

const figures: Partial<Record<string, Marks>> = media.figures;
const videos: Partial<Record<string, { seconds: number }>> = media.videos;

// The captures of a figure in the reader's language, in both schemes, and its mark.
export function helpFigure(
  id: string,
  language: string,
): HelpFigureMedia | undefined {
  const used = figures[id]?.[language] === undefined ? FALLBACK : language;
  const mark = figures[id]?.[used];
  const dark = files[`./${id}.${used}.dark.png`];
  const light = files[`./${id}.${used}.light.png`];
  if (mark === undefined || dark === undefined || light === undefined) {
    return undefined;
  }

  return { dark, light, spot: mark.spot };
}

export function helpVideo(
  id: string,
  language: string,
): HelpVideoMedia | undefined {
  const own = files[`./${id}.${language}.dark.webm`] !== undefined;
  const used = own ? language : FALLBACK;
  const entry = videos[id];
  const dark = files[`./${id}.${used}.dark.webm`];
  const light = files[`./${id}.${used}.light.webm`];
  if (entry === undefined || dark === undefined || light === undefined) {
    return undefined;
  }

  return { dark, light, seconds: entry.seconds };
}
