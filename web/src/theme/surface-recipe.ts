import type { Derivation } from "@slotted/theme";

// Spec A13, docs/specs/2026-10-29-appearance-studio-design.md. Each value lists, per scheme, the
// tokens it sets: a Slotted derivation for a colour, a CSS value for a shadow or a series.
// high-contrast keeps the compiled theme. The standard values repeat equori.theme.ts, so an
// element under another value returns to the compiled look; surface-recipe.theme.test.ts checks
// both the repetition and the contrast of every value.
export type SurfaceScheme = "dark" | "light";
export type SurfaceTokens = Readonly<Record<string, Derivation | string>>;
export type SurfaceRule = Readonly<
  Partial<Record<SurfaceScheme, SurfaceTokens>>
>;

// The values of each surface preference (spec A11 and A12).
export const surfaceSets = {
  depth: ["soft", "standard", "deep", "oled"],
  step: ["standard", "wide"],
  borders: ["none", "subtle", "strong"],
  shadows: ["flat", "soft", "deep"],
  chart: ["spectrum", "accent", "mono"],
  contrast: ["standard", "high"],
} as const;

type SurfaceName = keyof typeof surfaceSets;
type SurfaceValue<N extends SurfaceName> = (typeof surfaceSets)[N][number];

export const surfaceSchemes: readonly SurfaceScheme[] = ["dark", "light"];

// The ground of a dark scheme carries a tone's chroma up to 0.08, as equori.theme.ts does.
const dark = (l: number): Derivation => ({
  seed: "neutral",
  l: round(l),
  c: { scale: 0.22, max: 0.08 },
});

const light = (l: number, max: number): Derivation => ({
  seed: "neutral",
  l: round(Math.min(1, l)),
  c: { scale: 0.22, max },
});

// Lightness of the sunken ground, the surface and the base of the raised layer, per scheme.
const depthLevels = {
  soft: { dark: [0.15, 0.175, 0.175], light: [0.985, 0.99, 0.99] },
  standard: { dark: [0.13, 0.155, 0.155], light: [0.97, 0.985, 0.985] },
  deep: { dark: [0.095, 0.115, 0.115], light: [0.962, 0.98, 0.98] },
  oled: { dark: [0, 0, 0.085], light: [1, 1, 1] },
} as const;

// How far the raised layer sits above its base.
const stepLevels = {
  standard: { dark: 0.045, light: 0 },
  wide: { dark: 0.055, light: 0.012 },
} as const;

const shadowLevels = {
  flat: { dark: ["none", "none", "none"], light: ["none", "none", "none"] },
  soft: {
    dark: [
      "0 1px 3px rgb(0 0 0 / 0.45), 0 1px 2px -1px rgb(0 0 0 / 0.40)",
      "0 4px 6px -1px rgb(0 0 0 / 0.50), 0 2px 4px -2px rgb(0 0 0 / 0.45)",
      "0 10px 15px -3px rgb(0 0 0 / 0.60), 0 4px 6px -4px rgb(0 0 0 / 0.50)",
    ],
    light: [
      "0 1px 3px rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.08)",
      "0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.08)",
      "0 10px 15px -3px rgb(15 23 42 / 0.10), 0 4px 6px -4px rgb(15 23 42 / 0.08)",
    ],
  },
  deep: {
    dark: [
      "0 2px 6px rgb(0 0 0 / 0.55), 0 1px 2px rgb(0 0 0 / 0.50)",
      "0 8px 18px -4px rgb(0 0 0 / 0.65), 0 3px 6px -3px rgb(0 0 0 / 0.55)",
      "0 22px 40px -8px rgb(0 0 0 / 0.70), 0 8px 16px -8px rgb(0 0 0 / 0.60)",
    ],
    light: [
      "0 2px 6px rgb(15 23 42 / 0.12), 0 1px 2px rgb(15 23 42 / 0.10)",
      "0 8px 18px -4px rgb(15 23 42 / 0.16), 0 3px 6px -3px rgb(15 23 42 / 0.12)",
      "0 22px 40px -8px rgb(15 23 42 / 0.22), 0 8px 16px -8px rgb(15 23 42 / 0.14)",
    ],
  },
} as const;

// Eight hues at one OKLCH lightness per scheme, as equori.theme.ts sets them.
const spectrum = {
  dark: [
    "#8a82e9",
    "#cb7f00",
    "#00a8a8",
    "#de6674",
    "#069ce4",
    "#68a63f",
    "#c46dbd",
    "#db703b",
  ],
  light: [
    "#7368d4",
    "#b46400",
    "#009597",
    "#c6495b",
    "#0083ce",
    "#4d8e16",
    "#ad51a7",
    "#c4530f",
  ],
} as const;

const seriesSlots = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export const surfaceRecipe: {
  readonly [N in Exclude<SurfaceName, "depth" | "step">]: Readonly<
    Record<SurfaceValue<N>, SurfaceRule>
  >;
} = {
  borders: {
    none: {
      dark: {
        "--slotted-border-subtle": { alias: "--slotted-surface-raised" },
      },
      light: {
        "--slotted-border-subtle": { alias: "--slotted-surface-raised" },
      },
    },
    subtle: {
      dark: { "--slotted-border-subtle": borderDerivation(0.275, 0.22, 0.051) },
      light: {
        "--slotted-border-subtle": borderDerivation(0.898, 0.313, 0.049),
      },
    },
    strong: {
      dark: { "--slotted-border-subtle": borderDerivation(0.38, 0.29, 0.06) },
      light: { "--slotted-border-subtle": borderDerivation(0.82, 0.45, 0.06) },
    },
  },
  shadows: {
    flat: shadowRule("flat"),
    soft: shadowRule("soft"),
    deep: shadowRule("deep"),
  },
  chart: {
    spectrum: {
      dark: seriesTokens((slot) => spectrum.dark[slot]),
      light: seriesTokens((slot) => spectrum.light[slot]),
    },
    accent: {
      dark: seriesTokens((slot) => accentSeries(0.66, slot * 45)),
      light: seriesTokens((slot) => accentSeries(0.58, slot * 45)),
    },
    mono: {
      dark: seriesTokens((slot) => accentSeries(0.86 - slot * 0.055, 0)),
      light: seriesTokens((slot) => accentSeries(0.36 + slot * 0.055, 0)),
    },
  },
  contrast: {
    standard: {
      dark: { "--slotted-text-muted": borderDerivation(0.712, 0.318, 0.06) },
      light: { "--slotted-text-muted": borderDerivation(0.522, 0.913, 0.06) },
    },
    high: {
      dark: { "--slotted-text-muted": borderDerivation(0.8, 0.25, 0.05) },
      light: { "--slotted-text-muted": borderDerivation(0.43, 0.9, 0.06) },
    },
  },
};

// The grounds of one depth and step: the raised layer depends on both, so they form one rule.
export function groundRule(
  depth: SurfaceValue<"depth">,
  step: SurfaceValue<"step">,
): SurfaceRule {
  const [darkSunken, darkSurface, darkBase] = depthLevels[depth].dark;
  const [lightSunken, lightSurface, lightBase] = depthLevels[depth].light;

  return {
    dark: {
      "--slotted-surface-sunken": dark(darkSunken),
      "--slotted-surface": dark(darkSurface),
      "--slotted-surface-raised": dark(darkBase + stepLevels[step].dark),
    },
    light: {
      "--slotted-surface-sunken": light(lightSunken, 0.012),
      "--slotted-surface": light(lightSurface, 0.006),
      "--slotted-surface-raised": light(
        lightBase + stepLevels[step].light,
        0.006,
      ),
    },
  };
}

function borderDerivation(l: number, scale: number, max: number): Derivation {
  return { seed: "neutral", l, c: { scale, max } };
}

function shadowRule(level: keyof typeof shadowLevels): SurfaceRule {
  const tokens = ([sm, md, lg]: readonly [string, string, string]) => ({
    "--slotted-shadow-sm": sm,
    "--slotted-shadow-md": md,
    "--slotted-shadow-lg": lg,
  });

  return {
    dark: tokens(shadowLevels[level].dark),
    light: tokens(shadowLevels[level].light),
  };
}

function seriesTokens(
  value: (slot: (typeof seriesSlots)[number]) => Derivation | string,
) {
  return Object.fromEntries(
    seriesSlots.map((slot) => [
      `--slotted-data-${String(slot + 1)}`,
      value(slot),
    ]),
  );
}

function accentSeries(l: number, h: number): Derivation {
  return { seed: "accent", l: round(l), c: { scale: 1, max: 0.16 }, h };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
