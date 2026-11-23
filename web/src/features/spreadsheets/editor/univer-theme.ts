import { defaultTheme } from "@univerjs/presets";
import type { Theme } from "@univerjs/presets";

// The editor's theme with the accent of the application in place of its blue. Univer reads a
// theme of hexadecimal colours, so each step of the accent is mixed by the browser from the
// token and read back from a canvas.
export function univerTheme(host: HTMLElement): Theme {
  const accent = "var(--slotted-tone-accent-solid)";
  const mix = (share: number, with_: "white" | "black") =>
    resolveColor(
      host,
      `color-mix(in oklab, ${accent} ${String(share)}%, ${with_})`,
    );

  return {
    ...defaultTheme,
    primary: {
      50: mix(8, "white"),
      100: mix(16, "white"),
      200: mix(32, "white"),
      300: mix(50, "white"),
      400: mix(70, "white"),
      500: mix(86, "white"),
      600: mix(100, "white"),
      700: mix(84, "black"),
      800: mix(68, "black"),
      900: mix(52, "black"),
    },
  };
}

// The hexadecimal form of a CSS colour as host computes it.
function resolveColor(host: HTMLElement, color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  host.append(probe);

  const computed = getComputedStyle(probe).color;
  probe.remove();

  const context = document.createElement("canvas").getContext("2d");
  if (context === null) return defaultTheme.primary[600];

  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
