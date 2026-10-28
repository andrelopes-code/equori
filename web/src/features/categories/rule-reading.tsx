import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import {
  actionSentence,
  conditionSentence,
} from "@/features/categories/rule-sentence";
import type { RuleWords } from "@/features/categories/rule-sentence";
import type { RuleDraft } from "@/features/categories/rule-draft";
import styles from "@/features/categories/rule-reading.module.css";
import { useT } from "@/i18n/i18n-provider";

// BD-01: the rule as it reads — When, each later condition led by its join, then the numbered
// actions — kept in step with the form under it.
export function RuleReading({
  draft,
  words,
}: {
  draft: RuleDraft;
  words: RuleWords;
}) {
  const t = useT();
  return (
    <Section ground="surface">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("ruleEditor.reading")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <div className={styles.sheet} aria-live="polite">
          <Text size="sm" weight="semibold">
            {t("ruleEditor.when")}
          </Text>
          <ol className={styles.lines}>
            {draft.conditions.map((condition, i) => (
              <li key={i} className={styles.line}>
                <Text size="sm" tone="muted" className={styles.join}>
                  {i === 0 ? "" : t("ruleEditor.and")}
                </Text>
                <Text size="sm">{conditionSentence(condition, words)}</Text>
              </li>
            ))}
          </ol>
          <Text size="sm" weight="semibold">
            {t("ruleEditor.then")}
          </Text>
          <ol className={styles.lines}>
            {draft.actions.map((action, i) => (
              <li key={i} className={styles.line}>
                <Text
                  size="sm"
                  tone="muted"
                  numeric="tabular"
                  className={styles.join}
                >
                  {t("ruleEditor.step", { n: i + 1 })}
                </Text>
                <Text size="sm">{actionSentence(action, words)}</Text>
              </li>
            ))}
          </ol>
        </div>
      </SectionBody>
    </Section>
  );
}
