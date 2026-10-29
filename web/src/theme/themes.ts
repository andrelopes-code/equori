import { accentSeed, applyAccent, readAccent, useAccent } from "@/theme/accent";
import type { Accent } from "@/theme/accent";
import { applyCorners, readCorners, useCorners } from "@/theme/corners";
import type { Corners } from "@/theme/corners";
import { statusNames, statusSeeds, useStatusSeed } from "@/theme/status";
import type { StatusName, StatusSeed } from "@/theme/status";
import { tone, toneSeed, useTone } from "@/theme/tone";
import type { Tone } from "@/theme/tone";
import { typeface, useTypeface } from "@/theme/typeface";
import type { Typeface } from "@/theme/typeface";
import { applyVisual, readVisual, useVisual } from "@/theme/visual";
import type { Visual } from "@/theme/visual";

// The values a theme holds. Scheme, density, text size and motion are the reader's own and stay
// outside every theme (spec A1, docs/specs/2026-10-29-appearance-studio-design.md).
export interface ThemeValues extends Record<StatusName, StatusSeed> {
  accent: Accent;
  tone: Tone;
  corners: Corners;
  typeface: Typeface;
  visual: Visual;
}

export interface SavedTheme {
  id: string;
  name: string;
  values: ThemeValues;
}

export type CuratedTheme =
  | "equori"
  | "ledger"
  | "paper"
  | "forest"
  | "ocean"
  | "dusk"
  | "terminal"
  | "glass";

const neutralStatus = {
  success: "theme",
  danger: "theme",
  warning: "theme",
  info: "theme",
} as const;

// Each theme pairs its status colours with its own hue, so an amount reads as part of the palette.
export const curatedThemes: Readonly<Record<CuratedTheme, ThemeValues>> = {
  equori: {
    ...neutralStatus,
    accent: "indigo",
    tone: "graphite",
    corners: "standard",
    typeface: "geist",
    visual: "standard",
  },
  ledger: {
    ...neutralStatus,
    accent: "#3d6fd9",
    tone: "zinc",
    success: "#2f9e5f",
    danger: "#d64545",
    corners: "square",
    typeface: "grotesque",
    visual: "standard",
  },
  paper: {
    ...neutralStatus,
    accent: "#b4532a",
    tone: "stone",
    success: "#5f8a3a",
    danger: "#c2410c",
    corners: "soft",
    typeface: "humanist",
    visual: "standard",
  },
  forest: {
    ...neutralStatus,
    accent: "#2f9e6e",
    tone: "sage",
    success: "#65a30d",
    danger: "#e0565b",
    corners: "standard",
    typeface: "geist",
    visual: "standard",
  },
  ocean: {
    ...neutralStatus,
    accent: "cyan",
    tone: "slate",
    success: "#14b8a6",
    danger: "#f97066",
    corners: "round",
    typeface: "grotesque",
    visual: "standard",
  },
  dusk: {
    ...neutralStatus,
    accent: "pink",
    tone: "#7a6a86",
    success: "#34d399",
    danger: "#fb7185",
    corners: "round",
    typeface: "rounded",
    visual: "standard",
  },
  terminal: {
    ...neutralStatus,
    accent: "#f59e0b",
    tone: "zinc",
    success: "#22c55e",
    danger: "#ef4444",
    corners: "square",
    typeface: "mono",
    visual: "standard",
  },
  glass: {
    ...neutralStatus,
    accent: "violet",
    tone: "graphite",
    corners: "round",
    typeface: "geist",
    visual: "glass",
  },
};

export const curatedThemeIDs = Object.keys(
  curatedThemes,
) as readonly CuratedTheme[];

export function currentThemeValues(): ThemeValues {
  return {
    accent: readAccent(),
    tone: tone.read(),
    success: statusSeeds.success.read(),
    danger: statusSeeds.danger.read(),
    warning: statusSeeds.warning.read(),
    info: statusSeeds.info.read(),
    corners: readCorners(),
    typeface: typeface.read(),
    visual: readVisual(),
  };
}

// The values of the page, kept current as any control changes one of them.
export function useThemeValues(): ThemeValues {
  const [accent] = useAccent();
  const [toneValue] = useTone();
  const [success] = useStatusSeed("success");
  const [danger] = useStatusSeed("danger");
  const [warning] = useStatusSeed("warning");
  const [info] = useStatusSeed("info");
  const [corners] = useCorners();
  const [typefaceValue] = useTypeface();
  const [visual] = useVisual();

  return {
    accent,
    tone: toneValue,
    success,
    danger,
    warning,
    info,
    corners,
    typeface: typefaceValue,
    visual,
  };
}

export function applyThemeValues(values: ThemeValues): void {
  applyAccent(values.accent);
  tone.apply(values.tone);
  for (const name of statusNames) statusSeeds[name].apply(values[name]);
  applyCorners(values.corners);
  typeface.apply(values.typeface);
  applyVisual(values.visual);
}

// A preset and the hex seed it stands for are the same value.
export function sameThemeValues(a: ThemeValues, b: ThemeValues): boolean {
  return (
    accentSeed(a.accent) === accentSeed(b.accent) &&
    toneSeed(a.tone) === toneSeed(b.tone) &&
    statusNames.every((name) => a[name] === b[name]) &&
    a.corners === b.corners &&
    a.typeface === b.typeface &&
    a.visual === b.visual
  );
}

// The id of the first theme, curated then saved, that holds these values; null reads as custom.
export function matchTheme(
  values: ThemeValues,
  saved: readonly SavedTheme[],
): string | null {
  const curated = curatedThemeIDs.find((id) =>
    sameThemeValues(curatedThemes[id], values),
  );
  if (curated) return curated;

  return (
    saved.find((theme) => sameThemeValues(theme.values, values))?.id ?? null
  );
}
