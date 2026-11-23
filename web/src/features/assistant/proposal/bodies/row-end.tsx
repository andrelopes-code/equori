import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/decision-sheet.module.css";
import { ResultLabel } from "@/features/assistant/proposal/result-label";
import type { ResultStatus } from "@/features/assistant/proposal/result-label";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

interface RowEndProps {
  status: ResultStatus;
  // The proposal's request runs now.
  running: boolean;
  // The screen of the record an executed proposal wrote.
  screen: string | undefined;
}

// Families read: link, typography. The end of an operation row: the state word while it
// executes, and once it is decided its link to the record beside its state word.
export function RowEnd({ status, running, screen }: RowEndProps) {
  const t = useT();
  const served = useServed();
  const decided = !["pending", "executing", "waiting"].includes(status);
  const opens = screen !== undefined && served({ href: screen });

  if (running) {
    return (
      <span className={styles.opEnd}>
        <Text size="sm" tone="muted">
          {t("assistant.proposal.status.executing")}
        </Text>
      </span>
    );
  }

  if (!decided) return null;

  return (
    <span className={styles.opEnd}>
      {opens && (
        <Text size="sm">
          <Link render={routeTo({ href: screen })}>
            {t("assistant.proposal.open")}
            <span className={styles.icon14Inline}>
              <AssistantIcon name="link" />
            </span>
          </Link>
        </Text>
      )}
      <ResultLabel status={status} />
    </span>
  );
}
