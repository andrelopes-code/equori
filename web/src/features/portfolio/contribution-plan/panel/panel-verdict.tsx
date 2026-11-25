import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import type { Verdict } from "@/features/portfolio/contribution-plan/panel/verdict";
import { useT } from "@/i18n/i18n-provider";

interface PanelVerdictProps {
  verdict: Verdict;
  readOnly: boolean;
  onRelease: (released: boolean) => void;
}

// What the criteria do to the asset this month, and the way out of a hold.
export function PanelVerdict({
  verdict,
  readOnly,
  onRelease,
}: PanelVerdictProps) {
  const t = useT();

  const { action } = verdict;

  return (
    <div className={styles.verdict}>
      <div className={styles.verdictText} aria-live="polite">
        <Text size="lg" weight="semibold">
          {verdict.title}
        </Text>

        <Text size="sm" tone="muted">
          {verdict.body}
        </Text>
      </div>

      {action !== undefined && !readOnly && (
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          onClick={() => {
            onRelease(action === "release");
          }}
        >
          {t(
            action === "release"
              ? "contributionPlan.panel.buyAnyway"
              : "contributionPlan.panel.waitAgain",
          )}
        </Button>
      )}
    </div>
  );
}
