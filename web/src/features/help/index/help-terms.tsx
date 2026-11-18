import { Link as TextLink } from "@slotted/react/link";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface HelpTermsProps {
  terms: readonly { id: string; term: string }[];
}

// The terms of the glossary, each a link to its definition.
export function HelpTerms({ terms }: HelpTermsProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("help.glossary.title")}</SectionHeading>
          <SectionDescription>
            {t("help.glossary.description", {
              count: numberFormatter(locale).format(terms.length),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <ul className={styles.terms} role="list">
          {terms.map((term) => (
            <li key={term.id}>
              <Text size="sm" render={(props) => <span {...props} />}>
                <TextLink
                  underline="hover"
                  render={routeTo({
                    to: "/help/$page",
                    params: { page: "glossary" },
                    hash: term.id,
                  })}
                >
                  {term.term}
                </TextLink>
              </Text>
            </li>
          ))}
        </ul>
      </SectionBody>
    </Section>
  );
}
