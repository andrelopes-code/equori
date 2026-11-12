import type { CSSProperties } from "react";

import { accountCardColor } from "@/features/accounts";

import styles from "@/features/transactions/account-field/card-thumb.module.css";

interface CardThumbProps {
  color: number | undefined;
  logo: string | undefined;
  disabled?: boolean;
}

// Families read: avatar, card. An avatar draws a person; a card family draws a container for
// content. The picker needs a 52 by 33 px miniature of the card of the Cards page, with its
// material, a logo plate and a chip, which no family draws.
export function CardThumb({ color, logo, disabled = false }: CardThumbProps) {
  const ground = accountCardColor(color);
  const style = (
    ground === undefined ? undefined : { "--account-card-color": ground }
  ) as CSSProperties | undefined;

  return (
    <span
      className={styles.thumb}
      style={style}
      data-colour={ground === undefined ? undefined : ""}
      data-disabled={disabled || undefined}
      aria-hidden="true"
    >
      <span className={styles.plate}>
        {logo !== undefined && (
          <img className={styles.logo} src={logo} alt="" />
        )}
      </span>
      <span className={styles.chip} />
    </span>
  );
}
