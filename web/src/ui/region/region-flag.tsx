import styles from "@/ui/region/region-flag.module.css";
import { flagArt } from "@/ui/region/flag-art";

interface RegionFlagProps {
  // A region code of the application ("BR", "EU") or "global".
  region: string;
  size?: "sm" | "md" | "lg";
}

// Families read: avatar, badge, icon. None draws the flag of a region, so the flag is the
// application's own. It is decorative: the region's name stands beside it.
export function RegionFlag({ region, size = "md" }: RegionFlagProps) {
  const art = flagArt(region);

  return (
    <span
      className={styles.flag}
      data-art={art === null ? "plate" : region}
      data-size={size}
      aria-hidden="true"
    >
      {art ?? region.toUpperCase()}
    </span>
  );
}
