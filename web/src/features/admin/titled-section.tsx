import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

export function TitledSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>{children}</SectionBody>
    </Section>
  );
}
