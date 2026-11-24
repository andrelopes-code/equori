import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

interface PendingSectionProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
}

// PR11: a block while its read is pending: its title and description, busy until the data comes.
export function PendingSection({
  title,
  description,
  children,
}: PendingSectionProps) {
  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={title}
      aria-busy="true"
    >
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
