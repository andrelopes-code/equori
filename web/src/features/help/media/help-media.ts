import { helpMediaFiles as files } from "@/features/help/media/help-media-files.gen";
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
// Every file, media.json and the list of files are written by tools/help-media
// (docs/contributing/help.md).
const figures: Partial<Record<string, Marks>> = media.figures;
const videos: Partial<Record<string, { seconds: number }>> = media.videos;

// The captures of a figure in the reader's language, in both schemes, and its mark.
export function helpFigure(
  id: string,
  language: string,
): HelpFigureMedia | undefined {
  const used = figures[id]?.[language] === undefined ? FALLBACK : language;
  const mark = figures[id]?.[used];
  const dark = files[`${id}.${used}.dark.png`];
  if (mark === undefined || dark === undefined) {
    return undefined;
  }

  // One capture serves both schemes unless the tool wrote one for the light scheme.
  const light = files[`${id}.${used}.light.png`] ?? dark;

  return { dark, light, spot: mark.spot };
}

// A browser that does not play WebM VP9 gets no video: the steps and their figures are the
// same content (ADR 037).
export function helpVideo(
  id: string,
  language: string,
): HelpVideoMedia | undefined {
  if (!playsVideo()) return undefined;

  const own = files[`${id}.${language}.dark.webm`] !== undefined;
  const used = own ? language : FALLBACK;
  const entry = videos[id];
  const dark = files[`${id}.${used}.dark.webm`];
  if (entry === undefined || dark === undefined) {
    return undefined;
  }

  const light = files[`${id}.${used}.light.webm`] ?? dark;

  return { dark, light, seconds: entry.seconds };
}

function playsVideo(): boolean {
  const probe = document.createElement("video");

  return probe.canPlayType('video/webm; codecs="vp9"') !== "";
}
