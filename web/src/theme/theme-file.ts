import { useMemo, useSyncExternalStore } from "react";

import { accentSeed, accentSeeds, accents, isAccent } from "@/theme/accent";
import { isCorners } from "@/theme/corners";
import { preference } from "@/theme/preference";
import { statusSeeds } from "@/theme/status";
import { tone, toneSeed, toneSeeds, tones } from "@/theme/tone";
import { typeface } from "@/theme/typeface";
import type { SavedTheme, ThemeValues } from "@/theme/themes";
import { isVisual } from "@/theme/visual";

// Spec A5 and A6, docs/specs/2026-10-29-appearance-studio-design.md.
const FORMAT = "equori.theme";
const VERSION = 1;
const MAX_FILE = 4096;
const MAX_NAME = 40;
const MAX_SAVED = 50;

const saved = preference<string>(
  "equori.themes",
  (value) => value.startsWith("["),
  "[]",
  () => undefined,
);

export function themeName(name: string): string | null {
  const trimmed = name.trim();

  return trimmed.length > 0 && trimmed.length <= MAX_NAME ? trimmed : null;
}

export function readSavedThemes(): SavedTheme[] {
  return savedThemes(saved.read());
}

export function writeSavedThemes(themes: readonly SavedTheme[]): void {
  saved.apply(JSON.stringify(themes.slice(0, MAX_SAVED)));
}

export function useSavedThemes(): [
  SavedTheme[],
  (themes: readonly SavedTheme[]) => void,
] {
  const text = useSyncExternalStore(saved.subscribe, saved.snapshot);
  const themes = useMemo(() => savedThemes(text), [text]);

  return [themes, writeSavedThemes];
}

// Every colour is written as its hex seed, so the file reads the same in any version of the presets.
export function exportTheme(name: string, values: ThemeValues): string {
  const file = {
    format: FORMAT,
    version: VERSION,
    name,
    ...values,
    accent: accentSeed(values.accent),
    tone: toneSeed(values.tone),
  };

  return JSON.stringify(file, null, 2);
}

// An imported file is untrusted: the whole file is refused on its first invalid value.
export function parseTheme(
  text: string,
): { name: string; values: ThemeValues } | null {
  if (text.length > MAX_FILE) return null;

  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isRecord(file) || file.format !== FORMAT || file.version !== VERSION)
    return null;

  const name = typeof file.name === "string" ? themeName(file.name) : null;
  const values = themeValues(file);
  if (name === null || values === null) return null;

  return { name, values };
}

function savedThemes(text: string): SavedTheme[] {
  let list: unknown;
  try {
    list = JSON.parse(text);
  } catch {
    return [];
  }

  if (!Array.isArray(list)) return [];

  return list.flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.id !== "string") return [];

    const name = typeof entry.name === "string" ? themeName(entry.name) : null;
    const values = isRecord(entry.values) ? themeValues(entry.values) : null;
    if (name === null || values === null) return [];

    return [{ id: entry.id, name, values }];
  });
}

// Each value passes the check of the preference that stores it. A hex equal to a preset reads as
// that preset, so its swatch shows as chosen.
function themeValues(record: Record<string, unknown>): ThemeValues | null {
  const text = (key: string) => {
    const value = record[key];
    return typeof value === "string" ? value : "";
  };
  const colour = (key: string) => text(key).toLowerCase();

  const accent = colour("accent");
  const toneValue = colour("tone");
  const typefaceValue = text("typeface");
  const corners = text("corners");
  const visual = text("visual");
  if (
    !isAccent(accent) ||
    !tone.accepts(toneValue) ||
    !typeface.accepts(typefaceValue) ||
    !isCorners(corners) ||
    !isVisual(visual)
  )
    return null;

  const success = colour("success");
  const danger = colour("danger");
  const warning = colour("warning");
  const info = colour("info");
  if (
    !statusSeeds.success.accepts(success) ||
    !statusSeeds.danger.accepts(danger) ||
    !statusSeeds.warning.accepts(warning) ||
    !statusSeeds.info.accepts(info)
  )
    return null;

  return {
    accent: accents.find((a) => accentSeeds[a] === accent) ?? accent,
    tone: tones.find((s) => toneSeeds[s] === toneValue) ?? toneValue,
    success,
    danger,
    warning,
    info,
    corners,
    typeface: typefaceValue,
    visual,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
