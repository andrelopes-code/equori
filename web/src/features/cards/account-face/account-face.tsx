import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { useAccountAppearance } from "@/features/cards/account-face/use-account-appearance";
import { CardFace } from "@/ui/card-face/card-face";

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
  const { identity, appearance } = useAccountAppearance(account);

  return <CardFace {...identity} {...appearance} note={note} inset={inset} />;
}
