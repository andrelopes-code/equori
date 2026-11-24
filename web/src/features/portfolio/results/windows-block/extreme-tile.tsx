import type { Window } from "@/features/portfolio/results/model/rolling-windows";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import { formatMonthSlashYear, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

interface ExtremeTileProps {
  label: string;
  window: Window;
}

// A window and the month it ends on: the best or the worst.
export function ExtremeTile({ label, window }: ExtremeTileProps) {
  const t = useT();
  const [tag] = useAppLocale();

  return (
    <WindowTile
      label={label}
      value={
        <Toned value={window.value}>
          {formatSignedBasisPoints(toBasisPoints(window.value), tag)}
        </Toned>
      }
      note={t("portfolio.results.windows.until", {
        month: formatMonthSlashYear(window.end, tag),
      })}
    />
  );
}
