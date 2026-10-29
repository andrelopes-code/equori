import { List } from "@slotted/react/list";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { HelpIndexItem } from "@/features/help/help-index-item";
import { helpPages } from "@/features/help/help-pages";
import type { HelpKind } from "@/features/help/help-pages";
import { useT } from "@/i18n/i18n-provider";

interface HelpKindSectionProps {
  kind: HelpKind;
}

export function HelpKindSection({ kind }: HelpKindSectionProps) {
  const t = useT();

  const pages = helpPages.filter((p) => p.kind === kind);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t(`help.kind.${kind}`)}</SectionHeading>
          <SectionDescription>
            {t(`help.kind.${kind}.description`)}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <List variant="framed">
          {pages.map(({ id }) => (
            <HelpIndexItem key={id} id={id} />
          ))}
        </List>
      </SectionBody>
    </Section>
  );
}
