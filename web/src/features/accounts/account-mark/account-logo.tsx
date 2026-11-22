import { Skeleton } from "@slotted/react/skeleton";
import { useState } from "react";

import styles from "@/features/accounts/account-mark/account-mark.module.css";

interface AccountLogoProps {
  // Unset while the logo is still being resolved.
  src: string | undefined;
}

// The white plate of an institution's logo, covered by a placeholder until the image settles:
// an empty white plate reads as a missing logo. A failed image also settles, leaving the plate.
export function AccountLogo({ src }: AccountLogoProps) {
  const [settled, setSettled] = useState<string>();

  const loading = src === undefined || settled !== src;

  return (
    <span className={styles.plate}>
      <Skeleton loading={loading} shape="block" className={styles.cover}>
        {src !== undefined && (
          <img
            className={styles.logo}
            src={src}
            alt=""
            // A cached image is complete before its load event, which lands after the first
            // paint: settling here, in the commit, keeps the placeholder from flashing.
            ref={(img) => {
              if (img?.complete === true && img.naturalWidth > 0)
                setSettled(src);
            }}
            onLoad={() => {
              setSettled(src);
            }}
            onError={() => {
              setSettled(src);
            }}
          />
        )}
      </Skeleton>
    </span>
  );
}
