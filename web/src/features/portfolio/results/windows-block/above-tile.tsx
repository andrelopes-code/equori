import { ShareNote } from "@/features/portfolio/results/windows-block/share-note";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import type { IndexWindows } from "@/features/portfolio/results/windows-block/windows-figures";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AboveTileProps {
  index: IndexWindows;
  // The windows of the portfolio.
  total: number;
}

// PR7, PR10: the share of the windows above one index; an index beyond the first two has none.
export function AboveTile({ index, total }: AboveTileProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (index.above === null) return null;

  const percent = numberFormatter(tag, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <WindowTile
      label={t("portfolio.results.windows.above", { index: index.name })}
      value={percent.format(index.above.share)}
      note={
        <ShareNote count={index.above.count} total={total} tone="success" />
      }
    />
  );
}
