import { Glyph, Icon } from "@slotted/react/icon";
import type { ReactNode } from "react";

import { FeedMark } from "@/features/setup/market-data/feed-mark";
import styles from "@/features/setup/market-data/market-data.module.css";
import type { RegionVerdict } from "@/features/setup/market-data/region-verdict";
import { RegionFlag } from "@/ui/region/region-flag";

interface RegionBandProps {
  // A region code, or null for a band with no flag.
  region: string | null;
  title: string;
  // "Your region", beside the title.
  tag?: ReactNode;
  // The line under the title.
  line: string;
  // The verdict, at the end on a wide band and inside the line on a narrow one.
  verdict?: RegionVerdict;
  // Rows out of sight load: the band draws the loader they would.
  busy?: boolean;
  // A folded band draws the chevron.
  folded?: boolean;
  sub?: boolean;
}

// Families read: section, collapsible, list-item. None draws a band that names a region over rows
// that share its columns, with a flag and a verdict, so the band is the page's own. A folded band
// sits inside a native summary, which brings the keyboard and the focus order.
export function RegionBand({
  region,
  title,
  tag,
  line,
  verdict,
  busy = false,
  folded = false,
  sub = false,
}: RegionBandProps) {
  return (
    <div className={styles.band} data-sub={sub ? "" : undefined}>
      <span className={styles.bandTitle}>
        {region !== null && (
          <RegionFlag region={region} size={sub ? "md" : "lg"} />
        )}

        <span className={styles.bandText}>
          <span className={styles.bandName}>
            {title}
            {tag}
          </span>

          <span className={styles.bandLine}>
            {line}
            {verdict !== undefined && (
              <span className={styles.inlineVerdict} data-tone={verdict.tone}>
                {verdict.text}
              </span>
            )}
          </span>
        </span>
      </span>

      {verdict !== undefined && (
        <>
          <span className={styles.verdict} data-tone={verdict.tone}>
            {verdict.text}
          </span>

          <FeedMark tone={verdict.tone} running={busy} />
        </>
      )}

      {folded && (
        <span className={styles.chevron}>
          <Icon>
            <Glyph name="chevron-down" />
          </Icon>
        </span>
      )}
    </div>
  );
}
