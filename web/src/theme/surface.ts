import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";
import type { Preference } from "@/theme/preference";
import { groundName, surfaceSets } from "@/theme/surface-recipe";

// Spec A11 and A12, docs/specs/2026-10-29-appearance-studio-design.md.
export { surfaceSets };

export type SurfaceName = keyof typeof surfaceSets;
export type SurfaceValue<N extends SurfaceName> =
  (typeof surfaceSets)[N][number];
export type SurfaceValues = { [N in SurfaceName]: SurfaceValue<N> };

export const surfaceDefaults: SurfaceValues = {
  depth: "soft",
  step: "wide",
  borders: "subtle",
  shadows: "soft",
  chart: "spectrum",
  contrast: "standard",
};

export const surfaceNames = Object.keys(surfaceSets) as readonly SurfaceName[];

// The contrast of secondary text is a reading preference; a theme holds the others (spec A1).
export type ThemeSurfaceName = Exclude<SurfaceName, "contrast">;
export type ThemeSurfaces = Pick<SurfaceValues, ThemeSurfaceName>;

// The surfaces of a theme that names none: a curated theme, or a file written before A11.
export const standardSurfaces: ThemeSurfaces = {
  depth: "standard",
  step: "standard",
  borders: "subtle",
  shadows: "soft",
  chart: "spectrum",
};

export const themeSurfaceNames: readonly ThemeSurfaceName[] = [
  "depth",
  "step",
  "borders",
  "shadows",
  "chart",
];

export const surfaces = {
  depth: surface("depth"),
  step: surface("step"),
  borders: surface("borders"),
  shadows: surface("shadows"),
  chart: surface("chart"),
  contrast: surface("contrast"),
};

export function useSurface<N extends SurfaceName>(
  name: N,
): [SurfaceValue<N>, (value: SurfaceValue<N>) => void] {
  const value = surfaces[name] as Preference<SurfaceValue<N>>;

  return [useSyncExternalStore(value.subscribe, value.snapshot), value.apply];
}

// The attributes that give an element under the root a theme's own surfaces (spec A14): the variants
// of surface-variants.ts.
export function surfaceAttributes(values: ThemeSurfaces) {
  return {
    "data-slotted-variant-ground": groundName(values.depth, values.step),
    "data-slotted-variant-borders": values.borders,
    "data-slotted-variant-shadows": values.shadows,
    "data-slotted-variant-chart": values.chart,
  };
}

// Writes every surface value from storage, or its default, on the root.
export function applySurfaces(values?: SurfaceValues): void {
  for (const name of surfaceNames)
    applySurface(name, values?.[name] ?? surfaces[name].read());
}

export function applySurface<N extends SurfaceName>(
  name: N,
  value: SurfaceValue<N>,
): void {
  (surfaces[name] as Preference<SurfaceValue<N>>).apply(value);
}

function surface<N extends SurfaceName>(name: N): Preference<SurfaceValue<N>> {
  const fallback = surfaceDefaults[name];

  return preference<SurfaceValue<N>>(
    `equori.${name}`,
    surfaceSets[name],
    fallback,
    (value) => {
      paintSurface(name, value);
    },
  );
}

function paintSurface(name: SurfaceName, value: string): void {
  const root = document.documentElement;

  if (name === "depth" || name === "step")
    root.setAttribute(
      "data-slotted-variant-ground",
      groundName(surfaces.depth.snapshot(), surfaces.step.snapshot()),
    );
  else root.setAttribute(`data-slotted-variant-${name}`, value);
}
