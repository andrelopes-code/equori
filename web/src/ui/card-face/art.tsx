import { Band } from "@/ui/card-face/art/band";
import { Carbon } from "@/ui/card-face/art/carbon";
import { Contour } from "@/ui/card-face/art/contour";
import { Dots } from "@/ui/card-face/art/dots";
import { Orbits } from "@/ui/card-face/art/orbits";
import { Waves } from "@/ui/card-face/art/waves";

export const artKeys = [
  "plain",
  "aurora",
  "waves",
  "orbits",
  "band",
  "contour",
  "dots",
  "carbon",
  "brushed",
  "holo",
];

interface CardFaceArtProps {
  art: string | undefined;
}

// The vector arts only. `aurora`, `brushed` and `holo` are CSS on `data-art`.
export function CardFaceArt({ art }: CardFaceArtProps) {
  switch (art) {
    case "waves":
      return <Waves />;
    case "orbits":
      return <Orbits />;
    case "band":
      return <Band />;
    case "contour":
      return <Contour />;
    case "dots":
      return <Dots />;
    case "carbon":
      return <Carbon />;
    default:
      return null;
  }
}

export function artKey(art: string | undefined): string {
  return art !== undefined && artKeys.includes(art) ? art : "plain";
}
