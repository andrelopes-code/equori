export const lightInk = "#ffffff";
export const darkInk = "#050506";

export interface Ink {
  ink: "light" | "dark";
  ratio: number;
}

export function inkOf(color: string): Ink {
  const light = contrast(color, lightInk);
  const dark = contrast(color, darkInk);

  return light > dark
    ? { ink: "light", ratio: light }
    : { ink: "dark", ratio: dark };
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const r = linear((value >> 16) & 255);
  const g = linear((value >> 8) & 255);
  const b = linear(value & 255);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function linear(channel: number): number {
  const s = channel / 255;

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
