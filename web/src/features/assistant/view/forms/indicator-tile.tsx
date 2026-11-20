import type { IndicatorsData } from "@/features/assistant/view/forms/indicators-data";
import { sparkPath } from "@/features/assistant/view/forms/spark-path";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { numberFormatter } from "@/i18n/format";

interface IndicatorTileProps {
  tile: IndicatorsData["tiles"][number];
}

// One ratio: its name, its value (liquidity in months of expense), its months as a sparkline.
export function IndicatorTile({ tile }: IndicatorTileProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();

  const months = numberFormatter(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const value =
    tile.kind === "liquidity"
      ? t("assistantView.indicators.months", {
          n: months.format(tile.bp / 10000),
        })
      : valueText({ bp: tile.bp }, format);

  return (
    <div className={styles.tile} tabIndex={0}>
      <span className={styles.tileKey}>
        {t(`assistantView.indicators.${tile.kind}`)}
      </span>
      <span className={styles.tileValue}>{value}</span>
      <svg
        className={styles.mini}
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={sparkPath(tile.series)} />
      </svg>
    </div>
  );
}
