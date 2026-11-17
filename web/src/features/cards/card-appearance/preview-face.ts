import type { components } from "@/api/schema.gen";
import type { CardFaceProps } from "@/ui/card-face/card-face";

type Card = components["schemas"]["Card"];
type Institution = components["schemas"]["Institution"];

type Identity = Pick<
  CardFaceProps,
  "title" | "logo" | "institutionName" | "lastFour" | "network" | "holder"
>;

// The identity a card account's face carries: its title, logo and institution, with the holder,
// digits and network of the plastic card it shows ("" holder when it has none).
export function previewFace(
  title: string,
  institution: Institution | undefined,
  logo: string | undefined,
  plastic: Card | undefined,
): Identity {
  return {
    title,
    holder: plastic?.holder ?? "",
    ...(logo !== undefined && { logo }),
    ...(institution !== undefined && { institutionName: institution.name }),
    ...(plastic !== undefined && { lastFour: plastic.last_four }),
    ...(plastic?.network !== undefined && { network: plastic.network }),
  };
}
