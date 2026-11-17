import { Text } from "@slotted/react/typography";

import styles from "@/features/setup/usage/usage-details.module.css";
import type { numberFormatter } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface UsageGaugeProps {
  label: string;
  used: number;
  limit: number | undefined;
  number: ReturnType<typeof numberFormatter>;
  className?: string | undefined;
}

// Today's count of one measure (spec A8): the value end-aligned over a meter when a limit is
// declared, and alone when none is, since a track with no limit reads as zero percent. Element of
// the app's own. Family read: ProgressBar (it draws its label and value on one line above a
// track of the control height, and always draws the track).
export function UsageGauge({
  label,
  used,
  limit,
  number,
  className,
}: UsageGaugeProps) {
  const t = useT();

  const value =
    limit === undefined
      ? number.format(used)
      : t("assistant.usage.of", {
          count: number.format(used),
          limit: number.format(limit),
        });
  const share = limit === undefined ? 0 : Math.min(1, used / limit);

  return (
    <div
      className={cx(styles.gauge, className)}
      role="img"
      aria-label={`${label}: ${value}`}
    >
      <Text
        size="sm"
        numeric="tabular"
        align="end"
        truncate
        className={styles.value}
      >
        {value}
      </Text>

      <div
        className={styles.meter}
        data-empty={limit === undefined || undefined}
      >
        {limit !== undefined && (
          <div
            className={styles.fill}
            data-tone={gaugeTone(share)}
            style={{ inlineSize: `${String(share * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

function gaugeTone(share: number) {
  if (share >= 1) return "danger";

  return share >= 0.8 ? "warning" : "accent";
}
