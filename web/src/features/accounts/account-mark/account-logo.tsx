import { Skeleton } from "@slotted/react/skeleton";
import { useState } from "react";

import styles from "@/features/accounts/account-mark/account-mark.module.css";

interface AccountLogoProps {
  src: string;
}

// The white plate of an institution's logo, covered by a placeholder until the image settles:
// an empty white plate reads as a missing logo. A failed image also settles, leaving the plate.
export function AccountLogo({ src }: AccountLogoProps) {
  const [settled, setSettled] = useState<string>();

  const loading = settled !== src;

  return (
    <span className={styles.plate}>
      <Skeleton loading={loading} shape="block" className={styles.cover}>
        <img
          className={styles.logo}
          src={src}
          alt=""
          onLoad={() => {
            setSettled(src);
          }}
          onError={() => {
            setSettled(src);
          }}
        />
      </Skeleton>
    </span>
  );
}
