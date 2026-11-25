import type { components } from "@/api/schema.gen";
import { AboveTile } from "@/features/portfolio/results/windows-block/above-tile";
import { ExtremeTile } from "@/features/portfolio/results/windows-block/extreme-tile";
import { ShareNote } from "@/features/portfolio/results/windows-block/share-note";
import { TodayTile } from "@/features/portfolio/results/windows-block/today-tile";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import styles from "@/features/portfolio/results/windows-block/windows-block.module.css";
import type { WindowFigures } from "@/features/portfolio/results/windows-block/windows-figures";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type ReturnSeries = components["schemas"]["ReturnSeries"];

interface WindowTilesProps {
  figures: WindowFigures;
  // The read of the 12 months to today.
  trailing: { isPending: boolean; data: ReturnSeries | undefined };
  // The last date of the history.
  to: string;
}

// PR7: today's window, the best and the worst, the share below zero and the share above each of
// the first two indexes; a tile of an index exists only when the series holds the index.
export function WindowTiles({ figures, trailing, to }: WindowTilesProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const { extremes, negative } = figures;
  if (extremes === null) return null;

  const percent = numberFormatter(tag, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <dl className={styles.tileRow}>
      <TodayTile trailing={trailing} to={to} />

      <ExtremeTile
        label={t("portfolio.results.windows.best")}
        window={extremes.best}
      />

      <ExtremeTile
        label={t("portfolio.results.windows.worst")}
        window={extremes.worst}
      />

      <WindowTile
        label={t("portfolio.results.windows.negative")}
        value={percent.format(negative.share)}
        note={
          <ShareNote
            count={negative.count}
            total={negative.total}
            tone="danger"
          />
        }
      />

      {figures.indexes.map((index) => (
        <AboveTile key={index.id} index={index} />
      ))}
    </dl>
  );
}
