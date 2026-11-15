import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies.module.css";
import { gaugeShares } from "@/features/assistant/proposal/gauge-shares";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface LimitBodyProps {
  preview: Preview;
}

// Families read: typography. One gauge: the current limit filled, the requested one hatched, both
// written under it. A card with no current limit keeps the field rows.
export function LimitBody({ preview }: LimitBodyProps) {
  const t = useT();
  const valueText = useValueText();
  const limit = changeOf(preview, "limit");
  const before = limit?.before;
  const after = limit?.after;

  if (before?.amount === undefined || after?.amount === undefined) {
    return <ProposalChanges changes={preview.changes} />;
  }

  const shares = gaugeShares(before.amount, after.amount);
  const current = valueText(before);
  const requested = valueText(after);
  const rest = changesWithout(preview, ["limit"]);

  return (
    <div className={styles.body}>
      <div className={styles.gauge}>
        <div
          role="img"
          className={styles.track}
          aria-label={`${t("assistant.body.current")}: ${current ?? ""}, ${t("assistant.body.requested")}: ${requested ?? ""}`}
        >
          <span
            className={styles.fill}
            style={{ inlineSize: `${String(shares.current)}%` }}
          />
          <span
            className={styles.change}
            style={{
              insetInlineStart: `${String(shares.changeStart)}%`,
              inlineSize: `${String(100 - shares.changeStart)}%`,
            }}
          />
        </div>

        <div className={styles.gaugeLabels}>
          <Text size="xs" tone="muted">
            {t("assistant.body.current")}{" "}
            <Text size="xs" weight="semibold">
              {current}
            </Text>
          </Text>
          <Text size="xs" tone="muted">
            {t("assistant.body.requested")}{" "}
            <Text size="xs" weight="semibold">
              {requested}
            </Text>
          </Text>
        </div>
      </div>

      <ProposalChanges changes={rest} />
    </div>
  );
}
