import { useState } from "react";

import { globeArt } from "@/ui/region/flag-art";
import { useFlagUrl } from "@/ui/region/flag-url";
import styles from "@/ui/region/region-flag.module.css";

interface RegionFlagProps {
  // A region code of the application ("BR", "EU") or "global".
  region: string;
  // md beside text, lg on a band or a title. One size per place, so flags never differ.
  size?: "md" | "lg";
}

// Families read: avatar, badge, icon. None draws the flag of a region, so the flag is the
// application's own. A country's flag is its SVG from flag-icons; while it loads, when it fails
// and for a region without a file the tile is a plate with the code. It is decorative: the
// region's name stands beside it.
export function RegionFlag({ region, size = "md" }: RegionFlagProps) {
  const url = useFlagUrl(region);
  const [failed, setFailed] = useState<string | null>(null);

  if (region === "global")
    return (
      <span
        className={styles.flag}
        data-art="global"
        data-size={size}
        aria-hidden="true"
      >
        {globeArt()}
      </span>
    );

  const drawn = url !== null && failed !== url;

  return (
    <span
      className={styles.flag}
      data-art={drawn ? region : "plate"}
      data-size={size}
      aria-hidden="true"
    >
      {drawn ? (
        <img
          src={url}
          alt=""
          draggable={false}
          onError={() => {
            setFailed(url);
          }}
        />
      ) : (
        region.toUpperCase()
      )}
    </span>
  );
}
