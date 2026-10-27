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

// "How it is calculated" (design §4, "Explanation"): what the calculator answers, the steps in
// words, the formula with each symbol, the assumptions, the limits and the sources.
export function MethodSection({
  answers,
  steps,
  formula,
  assumptions,
  limits,
  sources,
}: {
  answers: string;
  steps: readonly string[];
  formula: readonly string[];
  assumptions: readonly string[];
  limits: readonly string[];
  sources: readonly Source[];
}) {
  const t = useT();
  const part = (title: MessageKey, children: ReactNode) => (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t(title)}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <Stack gap={2}>{children}</Stack>
      </SectionBody>
    </Section>
  );
  const lines = (texts: readonly string[]) =>
    texts.map((line) => (
      <Text key={line} size="sm">
        {line}
      </Text>
    ));
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.method")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <Stack gap={5}>
          {part("calc.method.answers", lines([answers]))}
          {part(
            "calc.method.steps",
            lines(steps.map((s, i) => `${String(i + 1)}. ${s}`)),
          )}
          {part(
            "calc.method.formula",
            formula.map((line) => (
              <Text key={line} size="sm" className={styles.formula}>
                {line}
              </Text>
            )),
          )}
          {part("calc.method.assumptions", lines(assumptions))}
          {part("calc.method.limits", lines(limits))}
          {part(
            "calc.method.sources",
            sources.map((s) => (
              <Text key={s.url} size="sm">
                <Link href={s.url} external>
                  {s.title}
                </Link>
              </Text>
            )),
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
