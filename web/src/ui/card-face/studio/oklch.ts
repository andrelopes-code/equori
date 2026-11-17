const hexPattern = /^#[0-9a-f]{6}$/i;

export function normalizeHex(text: string): string | null {
  return hexPattern.test(text) ? text.toLowerCase() : null;
}

// Out-of-gamut channels are clamped to the sRGB cube.
export function oklchToHex(l: number, c: number, h: number): string {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const red = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const green = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const blue = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;

  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const value = parseInt(hex.slice(1), 16);
  const r = linear((value >> 16) & 255);
  const g = linear((value >> 8) & 255);
  const b = linear(value & 255);
  const lc = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mc = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sc = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc;
  const bb = 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc;

  return {
    l: 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc,
    c: Math.hypot(a, bb),
    h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
  };
}

function channel(value: number): string {
  const encoded =
    value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  const byte = Math.round(255 * Math.min(1, Math.max(0, encoded)));

  return byte.toString(16).padStart(2, "0");
}

function linear(byte: number): number {
  const s = byte / 255;

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
