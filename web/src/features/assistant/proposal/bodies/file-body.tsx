import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import {
  fileOp,
  filePeriod,
} from "@/features/assistant/proposal/bodies/file-op";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface FileBodyProps {
  preview: Preview;
}

// Families read: typography. F8: the file, an arrow to where it goes, then how many lines it holds
// and the period they cover.
export function FileBody({ preview }: FileBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const op = fileOp(preview);
  const target =
    typeof op.target === "object"
      ? t(op.target.key, { count: op.target.count })
      : (op.target ?? "");
  const day =
    op.day === undefined ? "" : `${formatDayMonthNumeric(op.day, locale)} `;
  const ends = filePeriod(op, locale);
  const period = ends === null ? "" : t("assistant.body.period", ends);

  return (
    <div className={styles.fileOp}>
      <div className={styles.route}>
        <Text size="sm" weight="medium" className={styles.ellipsis}>
          {op.name}
        </Text>
      </div>

      <div className={styles.route}>
        <svg
          className={styles.icon14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
        <Text size="sm" className={styles.ellipsis}>
          {day}
          {target}
        </Text>
      </div>

      {op.lines !== undefined && (
        <div className={styles.holds}>
          <Text size="sm" tone="muted">
            {t(op.lines.key, { count: op.lines.count })}
          </Text>
          <Text size="sm" className={styles.figure}>
            {period}
          </Text>
        </div>
      )}
    </div>
  );
}
