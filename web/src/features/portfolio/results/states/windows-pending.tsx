import { PendingPlot } from "@/features/portfolio/results/states/pending-plot";
import { PendingSection } from "@/features/portfolio/results/states/pending-section";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import styles from "@/features/portfolio/results/windows-block/windows-block.module.css";
import { useT } from "@/i18n/i18n-provider";

const tiles = [
  "portfolio.results.windows.today",
  "portfolio.results.windows.best",
  "portfolio.results.windows.worst",
  "portfolio.results.windows.negative",
] as const;

// PR11: the four fixed tiles of the windows block; the tiles of the indexes come with the response.
export function WindowsPending() {
  const t = useT();

  return (
    <PendingSection
      title={t("portfolio.results.windows")}
      description={t("portfolio.results.windows.description")}
    >
      <dl className={styles.tileRow}>
        {tiles.map((label) => (
          <WindowTile
            key={label}
            label={t(label)}
            value={<PendingValue ch={6} />}
            note={<PendingValue ch={12} />}
          />
        ))}
      </dl>

      <div className={styles.plotBox}>
        <PendingPlot size="md" />
      </div>
    </PendingSection>
  );
}
