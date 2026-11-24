import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";

interface MonthsSectionProps {
  busy?: boolean;
  children: ReactNode;
}

// IM1: the surface, the title and the description of the block in each of its states.
export function MonthsSection({ busy = false, children }: MonthsSectionProps) {
  const t = useT();
  const title = t("instrument.months.title");

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={title}
      aria-busy={busy || undefined}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
          <SectionDescription>
            {t("instrument.months.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>{children}</SectionBody>
    </Section>
  );
}
