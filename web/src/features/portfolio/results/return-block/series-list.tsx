import styles from "@/features/portfolio/results/return-block/return-block.module.css";
import type { BlockFigures } from "@/features/portfolio/results/return-block/block-figures";
import { SeriesRow } from "@/features/portfolio/results/return-block/series-row";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";

interface SeriesListProps {
  figures: BlockFigures;
  on: readonly string[];
  onToggle: (id: string) => void;
}

// PR4: one row per series with its cumulative return; a switch for each index.
export function SeriesList({ figures, on, onToggle }: SeriesListProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = (fraction: number | null) =>
    fraction === null ? "" : formatBasisPoints(toBasisPoints(fraction), tag);

  return (
    <ul
      className={styles.seriesList}
      aria-label={t("portfolio.results.series")}
    >
      <SeriesRow
        name={t("portfolio.results.series.portfolio")}
        value={percent(figures.total)}
        slot={1}
        on
      />

      {figures.indexes.map((index) => (
        <SeriesRow
          key={index.id}
          name={index.name}
          value={percent(index.last)}
          slot={index.slot}
          dashed={index.dashed}
          on={on.includes(index.id)}
          onToggle={() => {
            onToggle(index.id);
          }}
        />
      ))}
    </ul>
  );
}
