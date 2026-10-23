import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import type { ReactNode } from "react";

import type { SettingsTopic } from "@/features/setup/settings-topics";

// One titled block of the settings page. The id is the target of the page's contents.
// Workaround for Slotted finding "A section divider on a surface stops at the inset": the rule
// under the header is off, as it does not reach the edges of the surface.
export function SettingsSection({
  topic,
  title,
  description,
  children,
}: {
  topic: SettingsTopic;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Section id={topic} ground="surface" size="lg" divider={false}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
          {description !== undefined && (
            <SectionDescription>{description}</SectionDescription>
          )}
        </SectionTitle>
      </SectionHeader>
      <SectionBody>{children}</SectionBody>
    </Section>
  );
}
