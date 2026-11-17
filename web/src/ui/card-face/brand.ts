import { contrast } from "@/ui/card-face/ink";
import type { LogoTraits } from "@/ui/card-face/logo-traits";

export type Brand = "auto" | "plate" | "name" | "none";

export type BrandDrawing =
  | { kind: "tile" }
  | { kind: "bare" }
  | { kind: "plate"; tone: "light" | "dark" }
  | { kind: "name" }
  | { kind: "none" };

const lightPlate = "#ffffff";
const darkPlate = "#141416";
const minimumContrast = 3;

export function brandOf(
  brand: Brand,
  hasLogo: boolean,
  traits: LogoTraits | undefined,
  color: string,
): BrandDrawing {
  if (brand === "none") {
    return { kind: "none" };
  }

  if (brand === "name") {
    return { kind: "name" };
  }

  if (brand === "plate" || !hasLogo || !traits) {
    return { kind: "plate", tone: "light" };
  }

  if (traits.opaque) {
    return { kind: "tile" };
  }

  if (contrast(traits.color, color) >= minimumContrast) {
    return { kind: "bare" };
  }

  const onDark =
    contrast(traits.color, darkPlate) > contrast(traits.color, lightPlate);

  return { kind: "plate", tone: onDark ? "dark" : "light" };
}
