import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { logoIndexQuery, logoOf } from "@/features/accounts";
import { cardsQuery } from "@/features/cards/api";
import { previewFace } from "@/features/cards/card-appearance/preview-face";
import { institutionsQuery } from "@/features/setup";
import { CardFace } from "@/ui/card-face/card-face";
import { useFaceAppearance } from "@/ui/card-face/use-face-appearance";

type Account = components["schemas"]["Account"];

interface AccountFaceProps {
  account: Account;
  // What stands at the end of the face's top strip.
  note?: ReactNode;
  // What stands inside the face, under its glare.
  inset?: ReactNode;
}

// The face of a card account as the Cards page draws it, for a screen that shows the card and
// does not link it: its stored look, the logo of its institution and its active plastic card.
export function AccountFace({ account, note, inset }: AccountFaceProps) {
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
  const identity = previewFace(account.name, institution, logo, plastic);

  return (
    <CardFace {...identity} {...appearance.props} note={note} inset={inset} />
  );
}
