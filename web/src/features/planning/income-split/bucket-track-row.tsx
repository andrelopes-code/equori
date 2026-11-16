import { Text } from "@slotted/react/typography";

import { BucketGauge } from "@/features/planning/income-split/bucket-gauge";
import { targetKey } from "@/features/planning/income-split/bucket-history";
import type { TrackRow } from "@/features/planning/income-split/bucket-history";
import { BucketMonthStrip } from "@/features/planning/income-split/bucket-month-strip";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketTrackRowProps {
  row: TrackRow;
  month: string;
  monthNames: readonly string[];
  money: (amount: number) => string;
  share: (bp: number) => string;
}

// One bucket on one line: its name and target share, the gauge of the month, what is left or
// over in words, and the strip of six months.
export function BucketTrackRow({
  row,
  month,
  monthNames,
  money,
  share,
}: BucketTrackRowProps) {
  const t = useT();
  const missed =
    row.status?.kind === "over" ||
    row.status?.kind === "short" ||
    row.status?.kind === "toGo";
  const status =
    row.status === undefined
      ? t("plan.dash")
      : t(`track.${row.status.kind}`, { amount: money(row.status.amount) });
  const real =
    row.shareBp === undefined
      ? money(row.real)
      : t("track.real", { amount: money(row.real), share: share(row.shareBp) });

  return (
    <div className={styles.row}>
      <div className={styles.stack}>
        <Text size="sm" weight="medium">
          {row.name}
        </Text>
        <Text size="xs" tone="muted">
          {t(targetKey(row.measure), { share: share(row.targetBp) })}
        </Text>
      </div>

      <BucketGauge
        label={t("track.gauge", {
          name: row.name,
          real: money(row.real),
          target: row.target === undefined ? t("plan.dash") : money(row.target),
        })}
        real={row.real}
        target={row.target}
        missed={missed}
      />

      <div className={styles.endStack}>
        <Text
          size="sm"
          weight="medium"
          numeric="tabular"
          {...(missed ? { tone: "danger" as const } : {})}
        >
          {status}
        </Text>
        <Text size="xs" tone="muted" numeric="tabular">
          {real}
        </Text>
      </div>

      <BucketMonthStrip cells={row.months} shown={month} names={monthNames} />
    </div>
  );
}
