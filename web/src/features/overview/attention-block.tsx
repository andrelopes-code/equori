import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { useT } from "@/i18n/i18n-provider";

export function AttentionBlock() {
  const t = useT();
  return (
    <Section ground="surface" size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("overview.attention.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody />
    </Section>
  );
}
