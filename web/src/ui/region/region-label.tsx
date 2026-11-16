import type { ReactNode } from "react";

import { useAppLocale, useT } from "@/i18n/i18n-provider";
import styles from "@/ui/region/region-label.module.css";
import { RegionFlag } from "@/ui/region/region-flag";
import { regionName } from "@/ui/region/region-name";

interface RegionLabelProps {
  region: string;
  size?: "md" | "lg";
  // The text beside the flag when it is not the region's name, such as a calendar's.
  children?: ReactNode;
}

// A flag and a name on one line. The flag is decorative, so the name carries the meaning.
export function RegionLabel({
  region,
  size = "md",
  children,
}: RegionLabelProps) {
  const t = useT();
  const [tag] = useAppLocale();

  return (
    <span className={styles.label}>
      <RegionFlag region={region} size={size} />
      {children ?? regionName(region, t, tag)}
    </span>
  );
}
