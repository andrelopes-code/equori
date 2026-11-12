import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

interface DetailSectionProps {
  title: string;
  children: ReactNode;
}

// One titled section of a layer body.
export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>{children}</SectionBody>
    </Section>
  );
}
