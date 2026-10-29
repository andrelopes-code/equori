const hex = /^#[0-9a-f]{6}$/;
const rgb = /^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)$/;

// A colour as the browser computes it (rgb() or hex) written as #rrggbb; null for any other form.
export function rgbToHex(value: string): string | null {
  const colour = value.trim().toLowerCase();
  if (hex.test(colour)) return colour;

  const match = rgb.exec(colour);
  if (match === null) return null;

  const channels = match.slice(1).map(Number);
  if (channels.some((channel) => channel > 255)) return null;

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
