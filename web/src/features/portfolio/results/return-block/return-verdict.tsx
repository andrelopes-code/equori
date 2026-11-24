import { Fragment } from "react";

import styles from "@/features/portfolio/results/return-block/return-block.module.css";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import { Toned } from "@/features/portfolio/results/shared/toned";
import { formatSignedBasisPoints, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ReturnVerdictProps {
  // The cumulative return of the period, as a fraction.
  total: number | null;
  whole: boolean;
  comparisons: { id: string; name: string; points: number }[];
}

// PR4: the percent of the period and the distance, in percentage points, to each index switched on.
export function ReturnVerdict({
  total,
  whole,
  comparisons,
}: ReturnVerdictProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (total === null) return null;

  const points = numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const byID = new Map(comparisons.map((c) => [c.id, c]));
  const parts = new Intl.ListFormat(tag, { type: "conjunction" }).formatToParts(
    [...byID.keys()],
  );

  return (
    <div className={styles.verdict}>
      <p className={styles.verdictLabel}>
        {t(
          whole
            ? "portfolio.results.return.label.all"
            : "portfolio.results.return.label",
        )}
      </p>

      <p className={styles.verdictValue}>
        <Toned value={total}>
          {formatSignedBasisPoints(toBasisPoints(total), tag)}
        </Toned>
      </p>

      {comparisons.length > 0 && (
        <p className={styles.verdictText}>
          {parts.map((part, position) => {
            const c = byID.get(part.value);
            if (part.type !== "element" || c === undefined)
              return <Fragment key={position}>{part.value}</Fragment>;

            return (
              <Toned key={position} value={c.points}>
                {t(
                  c.points >= 0
                    ? "portfolio.results.return.above"
                    : "portfolio.results.return.below",
                  {
                    points: points.format(Math.abs(c.points) * 100),
                    index: c.name,
                  },
                )}
              </Toned>
            );
          })}{" "}
          {t("portfolio.results.return.sameDays")}
        </p>
      )}
    </div>
  );
}
