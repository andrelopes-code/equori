// The geometry of wallet.module.css, in the units of the stylesheet.
const narrowRem = 30;
const reserveRem = 1;
const gapRem = 1.5;
const detailRem = 17;
const smallestRem = 10;
const largestRem = 20;

const faceRatio = 1.586;
const strip = 0.18;
const shortStrip = 0.155;
const shortStripFrom = 4;

interface Room {
  // The inline size of the wallet and the block size its widget leaves it, in pixels.
  width: number;
  height: number;
  count: number;
  // The root font size, in pixels.
  rem: number;
}

export interface Fit {
  // The width of a face and the height an unchosen face shows, in whole pixels.
  face: number;
  strip: number;
}

// The face and the strip that make the wallet as tall as its widget: the face is as wide as the
// height and the detail's column allow, between its smallest and largest size, and the strips
// of the other cards share the height that is left, from their share of the face up to the
// whole face (CW10). Undefined in the narrow form, whose height follows its content.
export function fitFace({ width, height, count, rem }: Room): Fit | undefined {
  if (count === 0 || height <= 0 || width < narrowRem * rem) return undefined;

  const share = count >= shortStripFrom ? shortStrip : strip;
  const room = height - reserveRem * rem;
  const byHeight = room / ((count - 1) * share + 1 / faceRatio);
  const byWidth = width - (gapRem + detailRem) * rem;
  const face = Math.floor(
    Math.max(Math.min(byHeight, byWidth, largestRem * rem), smallestRem * rem),
  );

  const whole = face / faceRatio;
  const left = count > 1 ? (room - whole) / (count - 1) : 0;

  return {
    face,
    strip: Math.floor(Math.min(Math.max(left, share * face), whole)),
  };
}
