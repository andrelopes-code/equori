import { Text } from "@slotted/react/typography";
import { useId } from "react";

import type { components } from "@/api/schema.gen";
import { signTone } from "@/features/portfolio/attribution/summary-figures";
import { YearColumnBars } from "@/features/portfolio/attribution/year-column-bars";
import styles from "@/features/portfolio/attribution/year-columns.module.css";
import { yearScale } from "@/features/portfolio/attribution/year-scale";
import { indexName } from "@/features/calculators";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type AttributionYear = components["schemas"]["AttributionYear"];

interface YearColumnsProps {
  years: readonly AttributionYear[];
  chosen: number;
  onChoose: (year: number) => void;
}

// build-own-element: no family draws columns that are also the choice of a period. Each year is a
// toggle button holding the bar of the portfolio's return in that year beside the bar of the same
// money at the CDI, its year and its rate; the rates are written in the button's name.
export function YearColumns({ years, chosen, onChoose }: YearColumnsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const headingId = useId();

  const scale = yearScale(years);
  const rateIndex = years.find((y) => y.rate !== undefined)?.rate?.index;

  return (
    <div className={styles.block}>
      <div className={styles.top}>
        <Text id={headingId} size="sm" weight="semibold">
          {t("portfolio.attribution.years")}
        </Text>

        <div className={styles.legend} aria-hidden="true">
          <span className={styles.key}>
            <span className={cx(styles.swatch, styles.portfolio)} />
            <Text size="xs" tone="muted">
              {t("portfolio.attribution.legend.portfolio")}
            </Text>
          </span>
          {rateIndex !== undefined && (
            <span className={styles.key}>
              <span className={cx(styles.swatch, styles.rate)} />
              <Text size="xs" tone="muted">
                {t("portfolio.attribution.legend.rate", {
                  index: indexName(rateIndex),
                })}
              </Text>
            </span>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={headingId}
        className={styles.columns}
        style={{ gridTemplateColumns: `repeat(${String(years.length)}, 1fr)` }}
      >
        {scale.columns.map((c) => {
          const rate =
            c.returnBp === undefined ? "" : formatBasisPoints(c.returnBp, tag);

          return (
            <button
              key={c.year}
              type="button"
              aria-pressed={c.year === chosen}
              aria-label={t("portfolio.attribution.yearColumn", {
                year: String(c.year),
                rate,
              })}
              className={styles.column}
              onClick={() => {
                onChoose(c.year);
              }}
            >
              <YearColumnBars column={c} scale={scale} />
              <Text
                size="md"
                weight="semibold"
                tone={signTone(c.returnBp ?? 0)}
              >
                {rate}
              </Text>
              <Text size="xs" tone="muted">
                {String(c.year)}
              </Text>
            </button>
          );
        })}
      </div>
    </div>
  );
}
