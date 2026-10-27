import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";

export type TypefacePreset =
  "geist" | "system" | "grotesque" | "humanist" | "rounded";

// A preset, or the family name of a face installed on the reader's device, after "custom:".
export type Typeface = TypefacePreset | `custom:${string}`;

// Letters, digits, spaces and the punctuation of family names; never a quote, so the name cannot
// leave the string it is written in.
const familyName = /^[\p{L}\p{N} ._-]{1,64}$/u;

export function customTypeface(name: string): Typeface | null {
  const trimmed = name.trim();
  return familyName.test(trimmed) ? `custom:${trimmed}` : null;
}

// The stack of each choice. geist ships with the application's first load; grotesque (Inter),
// humanist (Source Sans 3) and rounded (Nunito) ship as faces of their own, loaded the first time
// they are shown, so a reader who never picks one never downloads it. system is the operating
// system's own face.
export const typefaceStacks: Readonly<Record<TypefacePreset, string>> = {
  geist: "'Geist Variable', ui-sans-serif, system-ui, sans-serif",
  system: "system-ui, sans-serif",
  grotesque: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
  humanist: "'Source Sans 3 Variable', ui-sans-serif, system-ui, sans-serif",
  rounded: "'Nunito Variable', ui-sans-serif, system-ui, sans-serif",
};

const faces: Partial<Record<TypefacePreset, () => Promise<unknown>>> = {
  grotesque: () => import("@fontsource-variable/inter"),
  humanist: () => import("@fontsource-variable/source-sans-3"),
  rounded: () => import("@fontsource-variable/nunito"),
};

// Declares the face of a choice in the page. A face that fails to load leaves the stack's next
// font in force.
export function loadTypeface(value: Typeface): void {
  if (isPreset(value)) faces[value]?.().catch(() => undefined);
}

export const typefaces = Object.keys(
  typefaceStacks,
) as readonly TypefacePreset[];

function isPreset(value: string): value is TypefacePreset {
  return (typefaces as readonly string[]).includes(value);
}

export function typefaceStack(value: Typeface): string {
  return isPreset(value)
    ? typefaceStacks[value]
    : `"${value.slice("custom:".length)}", system-ui, sans-serif`;
}

const PROPERTY = "--slotted-font-family-sans";

export const typeface = preference<Typeface>(
  "equori.typeface",
  (value) =>
    isPreset(value) ||
    (value.startsWith("custom:") &&
      familyName.test(value.slice("custom:".length))),
  "geist",
  (value) => {
    loadTypeface(value);
    const root = document.documentElement.style;
    if (value === typeface.fallback) root.removeProperty(PROPERTY);
    else root.setProperty(PROPERTY, typefaceStack(value));
  },
);

export function useTypeface(): [Typeface, (value: Typeface) => void] {
  return [
    useSyncExternalStore(typeface.subscribe, typeface.snapshot),
    typeface.apply,
  ];
}
