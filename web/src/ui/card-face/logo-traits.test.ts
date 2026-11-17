import { describe, expect, it } from "vitest";

import { logoTraits } from "@/ui/card-face/logo-traits";

describe("logoTraits", () => {
  it("returns undefined for an image without a pixel of alpha 128 or more", () => {
    const data = pixels(
      [0, 0, 0, 0],
      [255, 0, 0, 127],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    );

    expect(logoTraits(data, 2, 2)).toBeUndefined();
  });

  it("averages an opaque image and marks it opaque", () => {
    const red: Pixel = [200, 0, 0, 255];
    const data = pixels(red, red, red, red);

    expect(logoTraits(data, 2, 2)).toEqual({ color: "#c80000", opaque: true });
  });

  it("marks an image with transparent corners as not opaque", () => {
    const none: Pixel = [0, 0, 0, 0];
    const data = pixels(
      none,
      none,
      none,
      none,
      [130, 10, 209, 255],
      none,
      none,
      none,
      none,
    );

    expect(logoTraits(data, 3, 3)).toEqual({ color: "#820ad1", opaque: false });
  });

  it("ignores near-white pixels in the colour", () => {
    const data = pixels([255, 255, 255, 255], [0, 0, 255, 255]);

    expect(logoTraits(data, 2, 1)?.color).toBe("#0000ff");
  });

  it("falls back to white when every pixel is near white", () => {
    const white: Pixel = [250, 250, 250, 255];
    const data = pixels(white, white, white, white);

    expect(logoTraits(data, 2, 2)).toEqual({ color: "#ffffff", opaque: true });
  });

  it("ignores pixels below alpha 128 in the colour", () => {
    const data = pixels([255, 0, 0, 127], [0, 255, 0, 128]);

    expect(logoTraits(data, 2, 1)).toEqual({ color: "#00ff00", opaque: false });
  });
});

type Pixel = [number, number, number, number];

function pixels(...list: Pixel[]): Uint8ClampedArray {
  return Uint8ClampedArray.from(list.flat());
}
