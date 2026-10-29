import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useState } from "react";

import { AppearancePreview } from "@/features/setup/appearance-preview";
import styles from "@/features/setup/appearance-studio.module.css";
import { oneOf } from "@/features/setup/one-of";
import { useT } from "@/i18n/i18n-provider";
import { schemes, useScheme } from "@/theme/scheme";

const devices = ["desktop", "phone"] as const;
type Device = (typeof devices)[number];

// The application drawn at the size of the chosen device, with the reader's scheme switch above
// it: the scheme is a reading preference, so it changes the whole page and not the drawing alone.
export function StudioCanvas() {
  const t = useT();
  const [scheme, setScheme] = useScheme();
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <section aria-label={t("studio.canvas")} className={styles.canvas}>
      <Inline justify="between" align="center" wrap="wrap" gap={4}>
        <SegmentedControl
          aria-label={t("more.scheme")}
          size="sm"
          value={scheme}
          onValueChange={(next) => {
            if (oneOf(schemes, next)) setScheme(next);
          }}
        >
          {schemes.map((s) => (
            <Segment key={s} value={s}>
              {t(`scheme.${s}`)}
            </Segment>
          ))}
        </SegmentedControl>
        <SegmentedControl
          aria-label={t("studio.device")}
          size="sm"
          value={device}
          onValueChange={(next) => {
            if (oneOf(devices, next)) setDevice(next);
          }}
        >
          {devices.map((d) => (
            <Segment key={d} value={d}>
              {t(`studio.device.${d}`)}
            </Segment>
          ))}
        </SegmentedControl>
      </Inline>

      <div className={styles.stage}>
        <div className={styles.device} data-device={device}>
          <AppearancePreview />
        </div>
      </div>
    </section>
  );
}
