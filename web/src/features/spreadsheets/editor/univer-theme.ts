import { defaultTheme } from "@univerjs/presets";
import type { Theme } from "@univerjs/presets";

const accent = "var(--slotted-tone-accent-solid)";
// The ground the editor stands on, the colour of the text over it and the other surfaces and
// lines of the application, in the scheme in force.
const ground = "var(--slotted-page-ground, var(--slotted-surface))";
const text = "var(--slotted-text)";
const raised = "var(--slotted-surface-raised)";
const line = "var(--slotted-border-subtle)";
const strongLine = "var(--slotted-border-strong)";
const mutedText = "var(--slotted-text-muted)";

// The text colour mixed into the ground, by its share in percent.
function shade(share: number): string {
  return `color-mix(in oklab, ${text} ${String(share)}%, ${ground})`;
}

// The grey scale of the light scheme. Univer draws it from the low steps: the ground at 0,
// the lines at 200, the secondary text at 600 and the text at 900.
const lightGreys = {
  0: ground,
  50: shade(3),
  100: shade(6),
  200: line,
  300: shade(22),
  400: strongLine,
  500: shade(52),
  600: mutedText,
  700: shade(76),
  800: shade(88),
  900: text,
  1000: text,
} as const;

// The grey scale of the dark scheme. Univer draws its dark elements from the high steps: the
// ground at 900, a menu or a dialog at 700 and their lines at 600. The low steps stay close to
// the text colour: they are the text of those elements, and the grid is drawn in the colour of
// step 200 inverted, so a light step 200 gives a faint line on the dark ground.
const darkGreys = {
  0: text,
  50: shade(97),
  100: shade(93),
  200: shade(86),
  300: mutedText,
  400: shade(52),
  500: strongLine,
  600: line,
  700: raised,
  800: `color-mix(in oklab, ${raised} 50%, ${ground})`,
  900: ground,
  1000: ground,
} as const;

// The theme of the editor from the tokens of the application: its accent in place of Univer's
// blue, and its ground, surfaces, lines and text in place of Univer's greys. Univer reads a
// theme of hexadecimal colours, so each step is computed by the browser from the tokens and
// read back from a canvas. The tokens change with the scheme, so the theme is built again when
// the scheme changes.
export function univerTheme(host: HTMLElement, dark: boolean): Theme {
  const resolve = colorResolver(host);
  const tint = (share: number, toward: "white" | "black") =>
    resolve(`color-mix(in oklab, ${accent} ${String(share)}%, ${toward})`);
  const greys = dark ? darkGreys : lightGreys;
  const grey = (step: keyof typeof lightGreys) => resolve(greys[step]);

  const theme: Theme = {
    ...defaultTheme,
    primary: {
      50: tint(8, "white"),
      100: tint(16, "white"),
      200: tint(32, "white"),
      300: tint(50, "white"),
      400: tint(70, "white"),
      500: tint(86, "white"),
      600: tint(100, "white"),
      700: tint(84, "black"),
      800: tint(68, "black"),
      900: tint(52, "black"),
    },
    gray: {
      0: grey(0),
      50: grey(50),
      100: grey(100),
      200: grey(200),
      300: grey(300),
      400: grey(400),
      500: grey(500),
      600: grey(600),
      700: grey(700),
      800: grey(800),
      900: grey(900),
      1000: grey(1000),
    },
  };

  resolve.release();

  return theme;
}

interface ColorResolver {
  (color: string): string;
  release: () => void;
}

// Gives the hexadecimal form of a CSS colour as host computes it. One element and one canvas
// serve every colour of a theme: each reading recomputes the styles of the page, so the 22
// colours are read from one element instead of 22.
function colorResolver(host: HTMLElement): ColorResolver {
  const probe = document.createElement("span");
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });

  host.append(probe);

  const resolve = (color: string): string => {
    if (context === null) return defaultTheme.primary[600];

    probe.style.color = color;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(probe).color;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;

    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };

  return Object.assign(resolve, {
    release: () => {
      probe.remove();
    },
  });
}
