import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/risk/risk-band-key.module.css";
import type {
  BandReason,
  RiskBand,
} from "@/features/portfolio/risk/risk-figures";
import { useT } from "@/i18n/i18n-provider";

interface RiskBandKeyProps {
  bands: readonly RiskBand[];
}

const reasons: readonly BandReason[] = ["excluded", "short"];

// The key of the bands the two charts draw (RK3, RK7): what a shaded run of months means. The
// bands carry no label on the plot, where a short run has no room for one.
export function RiskBandKey({ bands }: RiskBandKeyProps) {
  const t = useT();

  const shown = reasons.filter((r) => bands.some((b) => b.reason === r));
  if (shown.length === 0) return null;

  return (
    <Inline gap={6} align="center">
      {shown.map((reason) => (
        <Inline key={reason} gap={2} align="center">
          <span className={styles[reason]} aria-hidden="true" />
          <Text size="sm" tone="muted">
            {t(`portfolio.risk.band.${reason}`)}
          </Text>
        </Inline>
      ))}
    </Inline>
  );
}
