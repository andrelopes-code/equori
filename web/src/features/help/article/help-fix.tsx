import { HelpBlocks } from "@/features/help/article/help-blocks";
import type { HelpBlock } from "@/features/help/model/parse-help-page";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";

interface HelpFixProps {
  blocks: readonly HelpBlock[];
}

// A symptom reads the same way every time: the cause, the steps, the page with more (help spec,
// HP15).
export function HelpFix({ blocks }: HelpFixProps) {
  const t = useT();

  const first = blocks.findIndex((b) => b.type === "steps");
  const cause = first === -1 ? blocks : blocks.slice(0, first);
  const rest = first === -1 ? [] : blocks.slice(first);
  const steps = rest.filter((b) => b.type !== "pointer");
  const more = rest.filter((b) => b.type === "pointer");

  return (
    <dl className={styles.fix}>
      {cause.length > 0 && (
        <div className={styles.fixRow}>
          <dt className={styles.fixLabel}>{t("help.fix.cause")}</dt>
          <dd className={styles.fixBody}>
            <HelpBlocks blocks={cause} />
          </dd>
        </div>
      )}

      {steps.length > 0 && (
        <div className={styles.fixRow}>
          <dt className={styles.fixLabel}>{t("help.fix.steps")}</dt>
          <dd className={styles.fixBody}>
            <HelpBlocks blocks={steps} />
          </dd>
        </div>
      )}

      {more.length > 0 && (
        <div className={styles.fixRow}>
          <dt className={styles.fixLabel}>{t("help.fix.more")}</dt>
          <dd className={styles.fixBody}>
            <HelpBlocks blocks={more} />
          </dd>
        </div>
      )}
    </dl>
  );
}
