import { Accordion } from "@slotted/react/accordion";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/intro/plan-intro.module.css";
import { useT } from "@/i18n/i18n-provider";

const steps = [
  "contributionPlan.howStep1",
  "contributionPlan.howStep2",
  "contributionPlan.howStep3",
] as const;

// What the screen does in one sentence, and the three steps behind a collapsed "How it works".
export function PlanIntro() {
  const t = useT();

  return (
    <Stack gap={3}>
      <Text size="sm" tone="muted">
        {t("contributionPlan.intro")}
      </Text>

      <Accordion variant="plain" size="sm">
        <Collapsible value="how">
          <CollapsibleHeader>
            <CollapsibleTrigger>{t("contributionPlan.how")}</CollapsibleTrigger>
          </CollapsibleHeader>

          <CollapsiblePanel>
            <ol className={styles.steps}>
              {steps.map((key) => (
                <li key={key}>
                  <Text size="sm">{t(key)}</Text>
                </li>
              ))}
            </ol>
          </CollapsiblePanel>
        </Collapsible>
      </Accordion>
    </Stack>
  );
}
