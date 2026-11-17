export interface LogoTraits {
  color: string;
  opaque: boolean;
}

const solidAlpha = 250;
const visibleAlpha = 128;
const nearWhite = 240;

export function logoTraits(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): LogoTraits | undefined {
  const count = width * height;
  let visible = false;
  let counted = 0;
  const sum = [0, 0, 0];

  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const a = data[offset + 3] ?? 0;

    if (a < visibleAlpha) {
      continue;
    }

    visible = true;

    if (r >= nearWhite && g >= nearWhite && b >= nearWhite) {
      continue;
    }

    sum[0] = (sum[0] ?? 0) + r;
    sum[1] = (sum[1] ?? 0) + g;
    sum[2] = (sum[2] ?? 0) + b;
    counted++;
  }

  if (!visible) {
    return undefined;
  }

  const corners = [0, width - 1, count - width, count - 1];
  const opaque = corners.every(
    (pixel) => (data[pixel * 4 + 3] ?? 0) >= solidAlpha,
  );
  const color =
    counted === 0
      ? "#ffffff"
      : hexOf(sum.map((channel) => Math.round(channel / counted)));

  return { color, opaque };
}

function hexOf(channels: number[]): string {
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
