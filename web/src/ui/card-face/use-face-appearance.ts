import type { CardFaceProps } from "@/ui/card-face/card-face";
import {
  faceAppearance,
  suggestedColor,
  type FaceAPI,
} from "@/ui/card-face/studio/face-draft";
import { useLogoTraits } from "@/ui/card-face/use-logo-traits";

interface FaceAppearance {
  suggested: string;
  props: Pick<
    CardFaceProps,
    "color" | "art" | "chip" | "orientation" | "brand"
  >;
}

// The look of a card account: the stored face over the colour the logo suggests (spec 4.7).
export function useFaceAppearance(
  face: FaceAPI | undefined,
  slot: number | undefined,
  logo: string | undefined,
): FaceAppearance {
  const logoColor = useLogoTraits(logo)?.color;

  return {
    suggested: suggestedColor(slot, logoColor),
    props: faceAppearance(face, slot, logoColor),
  };
}
