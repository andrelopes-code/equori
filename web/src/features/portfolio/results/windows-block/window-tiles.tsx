import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import { Toned } from "@/features/portfolio/results/shared/toned";
import { AboveTile } from "@/features/portfolio/results/windows-block/above-tile";
import { ExtremeTile } from "@/features/portfolio/results/windows-block/extreme-tile";
import { ShareNote } from "@/features/portfolio/results/windows-block/share-note";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import styles from "@/features/portfolio/results/windows-block/windows-block.module.css";
import type { WindowFigures } from "@/features/portfolio/results/windows-block/windows-figures";
import {
  formatDate,
  formatSignedBasisPoints,
  numberFormatter,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface WindowTilesProps {
  figures: WindowFigures;
  // The last date of the history.
  to: string;
}

// PR7: today's window, the best and the worst, the share below zero and the share above each of
// the first two indexes; a tile of an index exists only when the series holds the index.
export function WindowTiles({ figures, to }: WindowTilesProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const { extremes, negative, windows } = figures;
  if (extremes === null) return null;

  const percent = numberFormatter(tag, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <dl className={styles.tileRow}>
      <WindowTile
        label={t("portfolio.results.windows.today")}
        value={
          <Toned value={extremes.last.value}>
            {formatSignedBasisPoints(toBasisPoints(extremes.last.value), tag)}
          </Toned>
        }
        note={t("portfolio.results.windows.today.note", {
          date: formatDate(to, tag),
        })}
      />

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
            total={windows.length}
            tone="danger"
          />
        }
      />

      {figures.indexes.map((index) => (
        <AboveTile key={index.id} index={index} total={windows.length} />
      ))}
    </dl>
  );
}
