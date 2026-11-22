import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { MethodHelp } from "@/features/portfolio/contribution-plan/editor/method-help";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { piotroskiFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import { factText } from "@/features/portfolio/contribution-plan/model/fact-labels";
import { useT } from "@/i18n/i18n-provider";

interface MethodBlockProps {
  index: number;
  editor: PlanEditor;
}

// The offer of the nine signals of Piotroski: one line with its text, its button and its help.
export function MethodBlock({ index, editor }: MethodBlockProps) {
  const t = useT();

  const text = t("contributionPlan.method.piotroski.text");

  function handleUse() {
    editor.addFactQuestions(
      index,
      piotroskiFacts.map((fact) => ({ fact, text: factText(t, fact, "") })),
    );
  }

  return (
    <div className={styles.methodRow}>
      <Text size="sm" tone="muted" truncate title={text}>
        {text}
      </Text>

      <Button size="sm" variant="outline" tone="secondary" onClick={handleUse}>
        {t("contributionPlan.method.piotroski.use")}
      </Button>

      <MethodHelp />
    </div>
  );
}
