export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// The drawn size of a picture at a zoom: at 1 the picture fits the stage whole and is never
// enlarged past its own pixels; each zoom step multiplies that fitted size.
export function fittedSize(
  natural: Size | null,
  stage: Size | null,
  zoom: number,
): Size | null {
  if (natural === null || stage === null) return null;
  if (natural.width === 0 || natural.height === 0) return null;

  const fit = Math.min(
    stage.width / natural.width,
    stage.height / natural.height,
    1,
  );

  return {
    width: Math.round(natural.width * fit * zoom),
    height: Math.round(natural.height * fit * zoom),
  };
}

// The scroll offset that keeps the point under the anchor still while the picture grows or
// shrinks by ratio. The anchor is measured from the stage's top-left corner.
export function anchoredScroll(
  scroll: Point,
  anchor: Point,
  ratio: number,
): Point {
  return {
    x: (scroll.x + anchor.x) * ratio - anchor.x,
    y: (scroll.y + anchor.y) * ratio - anchor.y,
  };
}
