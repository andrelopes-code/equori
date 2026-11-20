import type { ContributionData } from "@/features/assistant/view/forms/portfolio/portfolio-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

const pct = (bp: number, scale: number) =>
  `${String(scale > 0 ? (bp / scale) * 100 : 0)}%`;

// The plan's classes: today's share against the target and, with an amount, the share after it.
export function ContributionBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const d = data as ContributionData;

  const withAmount = d.amount.amount > 0;
  const scale = Math.max(
    0,
    ...d.classes.flatMap((c) => [c.share_bp, c.after_bp, c.target_bp]),
  );

  return (
    <>
      <ul className={styles.legend}>
        <li>
          <i className={styles.keyRef} />
          {t("assistantView.contribution.now")}
        </li>
        {withAmount && (
          <li>
            <i className={styles.key} />
            {t("assistantView.contribution.after")}
          </li>
        )}
        <li>
          <i className={styles.keyTick} />
          {t("assistantView.contribution.target")}
        </li>
      </ul>

      <ul className={styles.bars}>
        {d.classes.map((c) => (
          <li key={c.name} className={styles.item}>
            <div className={withAmount ? styles.pair : styles.row}>
              <span className={styles.rowKey}>
                <span className={styles.rowName}>{c.name}</span>
              </span>
              <span className={styles.rowValue}>
                {withAmount
                  ? format.money(c.amount)
                  : valueText({ bp: c.share_bp }, format)}
                <small>
                  {t("assistantView.contribution.of_target", {
                    target: valueText({ bp: c.target_bp }, format),
                  })}
                </small>
              </span>
              <span className={styles.track}>
                <i
                  className={styles.fillRef}
                  style={{ inlineSize: pct(c.share_bp, scale) }}
                />
                <i
                  className={styles.tick}
                  style={{ insetInlineStart: pct(c.target_bp, scale) }}
                />
              </span>
              {withAmount && (
                <span className={styles.track}>
                  <i
                    className={styles.fill}
                    style={{ inlineSize: pct(c.after_bp, scale) }}
                  />
                  <i
                    className={styles.tick}
                    style={{ insetInlineStart: pct(c.target_bp, scale) }}
                  />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
