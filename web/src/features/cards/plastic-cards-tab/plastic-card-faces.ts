import type { components } from "@/api/schema.gen";
import type { CardFaceProps } from "@/ui/card-face/card-face";

type Card = components["schemas"]["Card"];

export type FaceBase = Pick<
  CardFaceProps,
  | "title"
  | "logo"
  | "institutionName"
  | "color"
  | "art"
  | "chip"
  | "orientation"
  | "brand"
>;

// One face per card, in the order given: the account's look and appearance with the holder, digits, kind and
// state of the card.
export function plasticFaces(cards: readonly Card[], base: FaceBase) {
  return cards.map((card) => ({
    id: card.id,
    face: {
      ...base,
      holder: card.holder,
      lastFour: card.last_four,
      ...(card.network !== undefined && { network: card.network }),
      virtual: card.virtual === true,
      active: card.active,
    },
  }));
}
