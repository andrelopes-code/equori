import { Link } from "@slotted/react/link";
import type { MouseEventHandler } from "react";

import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import { linkHref } from "@/features/assistant/view/link-href";
import { SegmentedToggle } from "@/features/assistant/view/segmented-toggle";
import { ToggleIcon } from "@/features/assistant/view/toggle-icon";
import styles from "@/features/assistant/view/answer-view.module.css";
import type { ViewPayload } from "@/features/assistant/view/view-types";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

export type ViewMode = "chart" | "table";

interface ViewFootProps {
  open: ViewPayload["open"];
  // The view draws a chart that a table can replace.
  switchable: boolean;
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  onCopy: MouseEventHandler<HTMLButtonElement>;
}

// The foot of a view: the screen of its records, the chart/table switch and copy.
export function ViewFoot({
  open,
  switchable,
  mode,
  onMode,
  onCopy,
}: ViewFootProps) {
  const t = useT();
  const served = useServed();

  const href = open === undefined ? undefined : linkHref(open);
  const opens = href !== undefined && served({ href });

  return (
    <footer className={styles.foot}>
      {opens && (
        <Link render={routeTo({ href })} className={styles.open}>
          {t("assistantView.open")}
          <span className={styles.icon14}>
            <AssistantIcon name="link" />
          </span>
        </Link>
      )}

      <span className={styles.footEnd}>
        {switchable && (
          <SegmentedToggle
            label={t("assistantView.mode")}
            value={mode}
            onChange={onMode}
            options={[
              {
                value: "chart",
                title: t("assistantView.mode.chart"),
                content: <ToggleIcon name="chart" />,
              },
              {
                value: "table",
                title: t("assistantView.mode.table"),
                content: <ToggleIcon name="table" />,
              },
            ]}
          />
        )}

        <button
          type="button"
          className={styles.tool}
          aria-label={t("assistantView.copy")}
          title={t("assistantView.copy")}
          onClick={onCopy}
        >
          <AssistantIcon name="copy" />
        </button>
      </span>
    </footer>
  );
}
