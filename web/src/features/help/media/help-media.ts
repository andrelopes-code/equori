import { helpMediaFiles as files } from "@/features/help/media/help-media-files.gen";
import media from "@/features/help/media/media.json";
import type { VideoTimeline } from "@/features/help/video/compose-frame";

export interface HelpFigureMedia {
  dark: string;
  light: string;
  // The place the figure marks, in percent of the capture: start, top, width, height.
  spot: readonly number[];
}

export interface HelpVideoMedia extends VideoTimeline {
  // The address of the still of each part, in the order of the parts.
  stills: readonly string[];
  accent: string;
  seconds: number;
}

interface VideoEntry extends VideoTimeline {
  stills: readonly string[];
  accent: string;
}

type Marks = Partial<Record<string, { spot: number[] }>>;

// The language whose captures stand in for a language without its own.
const FALLBACK = "pt";

// The URL of each file; the browser fetches a capture or a still when its element asks for it.
// Every file, media.json and the list of files are written by tools/help-media
// (docs/contributing/help.md).
const figures: Partial<Record<string, Marks>> = media.figures;
const videos: Partial<Record<string, Partial<Record<string, VideoEntry>>>> =
  media.videos;

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

// The video of the steps in the reader's language: its timeline and the address of each still.
// The page draws it on a canvas (ADR 037, 7), so every browser with a 2D canvas plays it.
export function helpVideo(
  id: string,
  language: string,
): HelpVideoMedia | undefined {
  const entry = videos[id]?.[language] ?? videos[id]?.[FALLBACK];
  if (entry === undefined) return undefined;

  const stills = entry.stills.map((name) => files[name]);
  if (stills.some((url) => url === undefined)) return undefined;

  return {
    ...entry,
    stills: stills.filter((url) => url !== undefined),
    seconds: Math.round(entry.duration),
  };
}
