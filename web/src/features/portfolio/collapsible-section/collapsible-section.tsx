import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useId } from "react";
import type { ReactNode } from "react";

import styles from "@/features/portfolio/collapsible-section/collapsible-section.module.css";
import { Contained } from "@/features/portfolio/collapsible-section/contained";
import { PeekBody } from "@/features/portfolio/collapsible-section/peek-body";
import { useStoredCollapsed } from "@/features/portfolio/collapsible-section/use-stored-collapsed";
import { useT } from "@/i18n/i18n-provider";

interface CollapsibleSectionProps {
  title: string;
  description: ReactNode;
  // The browser key that keeps the reader's choice.
  storageKey: string;
  // Before the chevron: the controls of the section. A press on them acts on itself and leaves the
  // section as it is.
  actions?: ReactNode;
  children: ReactNode;
}

// A surface section that minimizes to its header and the start of its body. A click anywhere on
// the header toggles it: the chevron is the control a keyboard and a reader reach, and its click
// bubbles to the header, so the press is counted once.
export function CollapsibleSection({
  title,
  description,
  storageKey,
  actions,
  children,
}: CollapsibleSectionProps) {
  const t = useT();
  const [collapsed, setCollapsed] = useStoredCollapsed(storageKey);
  const bodyId = useId();

  return (
    <Section size="lg" ground="surface" heading="title" aria-label={title}>
      <SectionHeader
        className={styles.header}
        onClick={() => {
          setCollapsed(!collapsed);
        }}
      >
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
          <SectionDescription>{description}</SectionDescription>
        </SectionTitle>
        <SectionActions>
          {actions !== undefined && <Contained>{actions}</Contained>}
          <IconButton
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t(
              collapsed
                ? "fixedIncome.panel.expand"
                : "fixedIncome.panel.minimize",
              { name: title },
            )}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
          >
            <Icon>
              <Glyph name={collapsed ? "chevron-down" : "chevron-up"} />
            </Icon>
          </IconButton>
        </SectionActions>
      </SectionHeader>
      <SectionBody>
        <PeekBody
          id={bodyId}
          collapsed={collapsed}
          onExpand={() => {
            setCollapsed(false);
          }}
        >
          {children}
        </PeekBody>
      </SectionBody>
    </Section>
  );
}
