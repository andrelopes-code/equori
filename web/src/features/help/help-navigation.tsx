import {
  SideNavigation,
  SideNavigationList,
  SideNavigationSection,
  SideNavigationSectionLabel,
} from "@slotted/react/side-navigation";

import { HelpNavigationItem } from "@/features/help/help-navigation-item";
import { helpKinds, helpPages } from "@/features/help/help-pages";
import { useT } from "@/i18n/i18n-provider";

interface HelpNavigationProps {
  current: string | null;
}

// Every page of the help by kind, beside the page on show, as the settings page lays its panes.
export function HelpNavigation({ current }: HelpNavigationProps) {
  const t = useT();

  return (
    <SideNavigation
      aria-label={t("help.contents")}
      value={current}
      mode="expanded"
      // A navigation of its own inside the page, not the shell's column.
      landmark
      truncate="none"
    >
      {helpKinds.map((kind) => (
        <SideNavigationSection key={kind}>
          <SideNavigationSectionLabel>
            {t(`help.kind.${kind}`)}
          </SideNavigationSectionLabel>
          <SideNavigationList>
            {helpPages
              .filter((p) => p.kind === kind)
              .map(({ id }) => (
                <HelpNavigationItem key={id} id={id} />
              ))}
          </SideNavigationList>
        </SideNavigationSection>
      ))}
    </SideNavigation>
  );
}
