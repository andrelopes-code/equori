import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

interface RiskBlockProps {
  title: string;
  description: string;
  children: ReactNode;
}

// One titled block inside the risk section: a nested Section without a surface, whose heading
// sits one rank under the section's and in its muted mixed case (O17, Slotted section).
export function RiskBlock({ title, description, children }: RiskBlockProps) {
  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
          <SectionDescription>{description}</SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>{children}</SectionBody>
    </Section>
  );
}
