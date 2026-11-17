import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

interface PreviewSectionProps {
  title: MessageKey;
  children: ReactNode;
}

export function PreviewSection({ title, children }: PreviewSectionProps) {
  const t = useT();

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t(title)}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>{children}</SectionBody>
    </Section>
  );
}
