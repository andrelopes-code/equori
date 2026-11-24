import styles from "@/features/portfolio/results/windows-block/windows-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface ShareNoteProps {
  count: number;
  total: number;
  // The danger tone for the windows below zero, the success tone for the windows above an index.
  tone: "danger" | "success";
}

// The meter of a share and its count. The width of the fill is the share in percent: the mock's
// `share-NN` classes are a mock device and do not scale to any share.
export function ShareNote({ count, total, tone }: ShareNoteProps) {
  const t = useT();

  const width = total === 0 ? 0 : (count / total) * 100;
  const fill = tone === "danger" ? styles.shareBad : styles.shareGood;

  return (
    <>
      <span className={styles.shareBar} aria-hidden="true">
        <span
          className={`${styles.shareFill ?? ""} ${fill ?? ""}`}
          style={{ inlineSize: `${String(width)}%` }}
        />
      </span>

      {t("portfolio.results.windows.count", { count, total })}
    </>
  );
}
