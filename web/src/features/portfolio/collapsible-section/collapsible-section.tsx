import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import type { ReactNode } from "react";

import { useStoredCollapsed } from "@/features/portfolio/collapsible-section/use-stored-collapsed";

interface CollapsibleSectionProps {
  title: string;
  description: ReactNode;
  // The browser key that keeps the reader's choice.
  storageKey: string;
  children: ReactNode;
}

// A framed section of the page whose whole header opens and closes it. The root is a section
// named by its title, a landmark as the page's other sections are; the panel mounts on the
// first open, so a section kept closed loads none of its charts.
export function CollapsibleSection({
  title,
  description,
  storageKey,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useStoredCollapsed(storageKey);

  return (
    <Collapsible
      variant="framed"
      size="lg"
      level="2"
      mount="lazy"
      truncate
      open={!collapsed}
      onOpenChange={(open) => {
        setCollapsed(!open);
      }}
      render={(props) => <section {...props} aria-label={title} />}
    >
      <CollapsibleHeader>
        <CollapsibleTrigger description={description}>
          {title}
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>{children}</CollapsiblePanel>
    </Collapsible>
  );
}
