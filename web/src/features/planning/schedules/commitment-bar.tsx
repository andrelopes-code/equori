import { Text } from "@slotted/react/typography";

import type { Commitments } from "@/features/planning/schedules/commitments";
import { commitmentParts } from "@/features/planning/schedules/commitments";
import styles from "@/features/planning/schedules/commitment-bar.module.css";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface CommitmentBarProps {
  commitments: Commitments;
  scale: number;
}

const tones = {
  bill: "data-1",
  subscription: "data-2",
  savings: "data-3",
  free: "free",
} as const;

// Where the fixed income goes, as one part-to-whole line with a legend of shares (spec B2).
// Built here: the chart family draws axes and a legend box a single line of shares does not need,
// and no family draws a segmented bar (the budget plan's bar is built the same way).
export function CommitmentBar({ commitments, scale }: CommitmentBarProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const parts = commitmentParts(commitments);
  if (parts.length === 0) return null;

  const name = (key: (typeof parts)[number]["key"]) =>
    key === "free" ? t("schedules.freePart") : t(`schedules.group.${key}`);
  const shares = parts
    .map((p) => `${name(p.key)} ${formatBasisPoints(p.bp, locale)}`)
    .join(", ");
  const over = commitments.free < 0;

  return (
    <div className={styles.root}>
      <div
        role="img"
        aria-label={`${t("schedules.bar")}: ${shares}`}
        className={styles.bar}
      >
        {parts.map((p) => (
          <span
            key={p.key}
            className={styles.part}
            data-tone={tones[p.key]}
            style={{ flexGrow: p.amount }}
          />
        ))}
      </div>

      <div className={styles.legend} aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} className={styles.item}>
            <span className={styles.swatch} data-tone={tones[p.key]} />
            <Text size="xs" tone="muted">
              {name(p.key)}
            </Text>
            <Text size="xs" weight="medium" numeric="tabular">
              {formatBasisPoints(p.bp, locale)}
            </Text>
          </span>
        ))}
        {over && (
          <Text size="xs" tone="danger">
            {t("schedules.over", {
              amount: fmt.money(
                { amount: -commitments.free, currency: commitments.currency },
                scale,
              ),
            })}
          </Text>
        )}
      </div>
    </div>
  );
}
