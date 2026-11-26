import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { logoIndexQuery, logoOf } from "@/features/accounts";
import { cardsQuery } from "@/features/cards/api";
import { previewFace } from "@/features/cards/card-appearance/preview-face";
import { institutionsQuery } from "@/features/setup";
import { useFaceAppearance } from "@/ui/card-face/use-face-appearance";

type Account = components["schemas"]["Account"];

// The identity and the look of a card account's face: its stored look, the logo of its
// institution and its active plastic card. A screen that draws beside the face in its colour
// reads the colour here.
export function useAccountAppearance(account: Account) {
  const api = useApi();
  const institutions = useQuery(institutionsQuery(api));
  const logos = useQuery(logoIndexQuery);
  const cards = useQuery(cardsQuery(api, account.id));

  const institution = institutions.data?.find(
    (i) => i.id === account.institution_id,
  );
  const plastic = cards.data?.find((card) => card.active);
  const logo = logoOf(institution?.identifier, logos.data);
  const appearance = useFaceAppearance(account.face, account.color, logo);

  return {
    identity: previewFace(account.name, institution, logo, plastic),
    appearance: appearance.props,
  };
}
