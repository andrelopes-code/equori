import type { components } from "@/api/schema.gen";
import { CardFace } from "@/ui/card-face/card-face";
import { useFaceAppearance } from "@/ui/card-face/use-face-appearance";

import styles from "@/features/transactions/account-field/card-thumb.module.css";

type Account = components["schemas"]["Account"];

interface CardThumbProps {
  account: Account;
  logo: string | undefined;
  disabled?: boolean;
}

// Families read: avatar, card. An avatar draws a person; a card family draws a container for
// content. The picker needs a 52 px miniature of the card face of the Cards page (ui/card-face),
// which at that width draws its colour, its art and the issuer's brand.
export function CardThumb({ account, logo, disabled = false }: CardThumbProps) {
  const appearance = useFaceAppearance(account.face, account.color, logo);

  return (
    <span
      className={styles.thumb}
      data-disabled={disabled || undefined}
      aria-hidden="true"
    >
      <CardFace
        title={account.name}
        {...(logo === undefined ? {} : { logo })}
        holder=""
        {...appearance.props}
      />
    </span>
  );
}
