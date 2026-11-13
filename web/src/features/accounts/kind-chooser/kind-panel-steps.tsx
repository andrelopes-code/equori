import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
  SectionHeading,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import { kindFacts } from "@/features/accounts/kind-chooser/kind-facts";
import styles from "@/features/accounts/kind-chooser/kind-panel.module.css";
import type { Kind } from "@/features/accounts/model/account-kinds";
import { useT } from "@/i18n/i18n-provider";

interface KindPanelStepsProps {
  kind: Kind;
}

// Section 4: the steps of the form in the order AccountForm draws them; own steps carry the accent.
export function KindPanelSteps({ kind }: KindPanelStepsProps) {
  const t = useT();
  const { steps } = kindFacts(kind);

  return (
    <Section size="sm" level="4">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("kindPanel.asks")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.key} data-own={step.own ? "" : undefined}>
              <Text size="sm" wrap="nowrap">
                {step.wrap ? t(step.wrap, { step: t(step.key) }) : t(step.key)}
              </Text>
            </li>
          ))}
        </ol>
      </SectionBody>
    </Section>
  );
}
