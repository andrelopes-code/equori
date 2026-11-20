import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import {
  heightOf,
  yearScale,
} from "@/features/portfolio/attribution/year-scale";
import styles from "@/features/portfolio/attribution/year-columns.module.css";
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
// toggle button holding its column, the mark of the CDI and of the IPCA on the same money, its
// year and its rate; the rate and the marks are written in the button's name.
export function YearColumns({ years, chosen, onChoose }: YearColumnsProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const scale = yearScale(years);
  const zero = heightOf(scale, 0);
  const rateIndex = years.find((y) => y.rate !== undefined)?.rate?.index;
  const inflationIndex = years.find((y) => y.inflation !== undefined)?.inflation
    ?.index;

  return (
    <div className={styles.block}>
      <div
        role="group"
        aria-label={t("portfolio.attribution.years")}
        className={styles.columns}
        style={{ gridTemplateColumns: `repeat(${String(years.length)}, 1fr)` }}
      >
        {scale.columns.map((c) => {
          const value = c.returnBp ?? 0;
          const top = heightOf(scale, Math.max(value, 0));
          const bottom = heightOf(scale, Math.min(value, 0));
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
              <span className={styles.plot} aria-hidden="true">
                <span
                  className={styles.zero}
                  style={{ bottom: `${String(zero)}%` }}
                />
                <span
                  className={cx(styles.bar, value < 0 && styles.negative)}
                  style={{
                    bottom: `${String(bottom)}%`,
                    height: `${String(top - bottom)}%`,
                  }}
                />
                {c.rateBp !== undefined && (
                  <span
                    className={styles.rateMark}
                    style={{ bottom: `${String(heightOf(scale, c.rateBp))}%` }}
                  />
                )}
                {c.inflationBp !== undefined && (
                  <span
                    className={styles.inflationMark}
                    style={{
                      bottom: `${String(heightOf(scale, c.inflationBp))}%`,
                    }}
                  />
                )}
              </span>
              <Text size="sm" weight="semibold">
                {String(c.year)}
              </Text>
              <Text size="xs" tone="muted">
                {rate}
              </Text>
            </button>
          );
        })}
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span className={styles.key}>
          <span className={cx(styles.swatch, styles.bar)} />
          <Text size="xs" tone="muted">
            {t("portfolio.attribution.legend.portfolio")}
          </Text>
        </span>
        {rateIndex !== undefined && (
          <span className={styles.key}>
            <span className={cx(styles.swatch, styles.rateKey)} />
            <Text size="xs" tone="muted">
              {t("portfolio.attribution.legend.rate", {
                index: indexName(rateIndex),
              })}
            </Text>
          </span>
        )}
        {inflationIndex !== undefined && (
          <span className={styles.key}>
            <span className={cx(styles.swatch, styles.inflationKey)} />
            <Text size="xs" tone="muted">
              {t("portfolio.attribution.legend.inflation", {
                index: indexName(inflationIndex),
              })}
            </Text>
          </span>
        )}
      </div>
    </div>
  );
}
