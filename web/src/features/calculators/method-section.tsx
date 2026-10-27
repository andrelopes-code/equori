import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Link } from "@slotted/react/link";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/calculators/calculators.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

export interface Source {
  title: string;
  url: string;
}

// "How it is calculated" (design §4, "Explanation"): the steps in words, the formula with each
// symbol, the assumptions, the limits and the sources. The page's subheading states what the
// calculator answers. Closed until asked for: the reader comes for the result, and the method
// is its reference.
export function MethodSection({
  steps,
  formula,
  assumptions,
  limits,
  sources,
  notes = [],
}: {
  steps: readonly string[];
  formula: readonly string[];
  assumptions: readonly string[];
  limits: readonly string[];
  sources: readonly Source[];
  // Words that follow the steps unnumbered, such as a regional name of the method.
  notes?: readonly string[];
}) {
  const t = useT();
  const part = (title: MessageKey, children: ReactNode) => (
    <Section size="sm" divider={false}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t(title)}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>{children}</SectionBody>
    </Section>
  );
  const list = (texts: readonly string[], ordered = false) => {
    const items = texts.map((line) => (
      <li key={line}>
        <Text size="sm" wrap="pretty">
          {line}
        </Text>
      </li>
    ));
    return ordered ? (
      <ol className={styles.list}>{items}</ol>
    ) : (
      <ul className={styles.list}>{items}</ul>
    );
  };
  return (
    <Collapsible variant="framed" level="2" size="lg">
      <CollapsibleHeader>
        <CollapsibleTrigger description={t("calc.method.description")}>
          {t("calc.method")}
        </CollapsibleTrigger>
      </CollapsibleHeader>
      <CollapsiblePanel>
        <div className={styles.pair}>
          <Stack gap={6}>
            {part(
              "calc.method.steps",
              <Stack gap={3}>
                {list(steps, true)}
                {notes.map((line) => (
                  <Text key={line} size="sm" tone="muted" wrap="pretty">
                    {line}
                  </Text>
                ))}
              </Stack>,
            )}
            {part(
              "calc.method.formula",
              <div className={styles.formula}>
                {formula.map((line) => (
                  <Text key={line} size="sm">
                    {line}
                  </Text>
                ))}
              </div>,
            )}
          </Stack>
          <Stack gap={6}>
            {part("calc.method.assumptions", list(assumptions))}
            {part("calc.method.limits", list(limits))}
            {part(
              "calc.method.sources",
              <Stack gap={2}>
                {sources.map((s) => (
                  <Text key={s.url} size="sm">
                    <Link href={s.url} external>
                      {s.title}
                    </Link>
                  </Text>
                ))}
              </Stack>,
            )}
          </Stack>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
