import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
  SectionHeading,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import { kindCountText } from "@/features/accounts/kind-chooser/kind-count-text";
import { kindFacts } from "@/features/accounts/kind-chooser/kind-facts";
import styles from "@/features/accounts/kind-chooser/kind-panel.module.css";
import type { Kind } from "@/features/accounts/model/account-kinds";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface KindPanelFactsProps {
  kind: Kind;
  count: number;
}

// Section 4 and KC6: where the account opens, whether it counts toward liquidity, how many exist.
export function KindPanelFacts({ kind, count }: KindPanelFactsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const facts = kindFacts(kind);
  const countText =
    count === 0 ? t(facts.noneLabel) : kindCountText(t, tag, count, kind);
  const rows = [
    { label: t("kindPanel.opensIn"), value: t(facts.opensIn), muted: false },
    {
      label: t("kindPanel.liquidity"),
      value: t(facts.liquid ? "kindPanel.yes" : "kindPanel.no"),
      muted: false,
    },
    { label: t(facts.countLabel), value: countText, muted: count === 0 },
  ];

  return (
    <Section size="sm" level="4">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("kindPanel.after")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <DescriptionList
          variant="ruled"
          valueAlign="end"
          termWidth="10rem"
          className={styles.facts}
        >
          {rows.map((row) => (
            <DescriptionListItem key={row.label} data-fact="">
              <DescriptionListTerm>{row.label}</DescriptionListTerm>
              <DescriptionListDescription>
                <Text
                  size="sm"
                  numeric="tabular"
                  wrap="nowrap"
                  tone={row.muted ? "muted" : "inherit"}
                  data-fact-value=""
                >
                  {row.value}
                </Text>
              </DescriptionListDescription>
            </DescriptionListItem>
          ))}
        </DescriptionList>
      </SectionBody>
    </Section>
  );
}
