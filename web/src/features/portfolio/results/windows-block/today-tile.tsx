import type { components } from "@/api/schema.gen";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import { formatDate, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

type ReturnSeries = components["schemas"]["ReturnSeries"];

interface TodayTileProps {
  // The read of the 12 months to today.
  trailing: { isPending: boolean; data: ReturnSeries | undefined };
  // The last date of the history.
  to: string;
}

// PR7: the 12 months to today. A return that is undefined or failed to load reads a dash.
export function TodayTile({ trailing, to }: TodayTileProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const returnBP = trailing.data?.points.at(-1)?.return_bp;

  return (
    <WindowTile
      label={t("portfolio.results.windows.today")}
      value={
        <>
          {trailing.isPending && <PendingValue ch={6} />}

          {!trailing.isPending && returnBP === undefined && "–"}

          {returnBP !== undefined && (
            <Toned value={returnBP}>
              {formatSignedBasisPoints(returnBP, tag)}
            </Toned>
          )}
        </>
      }
      note={t("portfolio.results.windows.today.note", {
        date: formatDate(to, tag),
      })}
    />
  );
}
