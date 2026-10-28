import { Icon } from "@slotted/react/icon";
import {
  SideNavigation,
  SideNavigationDescription,
  SideNavigationEnd,
  SideNavigationIcon,
  SideNavigationItem,
  SideNavigationLabel,
  SideNavigationLink,
  SideNavigationList,
  SideNavigationSection,
  SideNavigationSectionLabel,
} from "@slotted/react/side-navigation";

import { SettingsIcon } from "@/features/setup/settings-icon";
import {
  settingsGroups,
  settingsTopics,
} from "@/features/setup/settings-topics";
import type { SettingsTopic } from "@/features/setup/settings-topics";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

// The panes of the settings page, grouped. Beside a pane it marks the one on show; on a phone it is
// the index the reader opens a pane from, so each row says what its pane holds and points onward.
export function SettingsNavigation({
  current,
  index,
}: {
  current: SettingsTopic | null;
  index: boolean;
}) {
  const t = useT();
  return (
    <SideNavigation
      aria-label={t("settings.contents")}
      value={current}
      mode="expanded"
      // A navigation of its own inside the page, not the shell's column.
      landmark
      size={index ? "lg" : "md"}
      truncate={index ? "none" : "end"}
    >
      {settingsGroups.map((group) => (
        <SideNavigationSection key={group.id}>
          <SideNavigationSectionLabel>
            {t(group.title)}
          </SideNavigationSectionLabel>
          <SideNavigationList>
            {settingsTopics
              .filter((topic) => topic.group === group.id)
              .map((topic) => (
                <SideNavigationItem key={topic.id} value={topic.id}>
                  <SideNavigationLink
                    render={routeTo({
                      to: "/settings",
                      search: { section: topic.id },
                    })}
                  >
                    <SideNavigationIcon>
                      <SettingsIcon name={topic.id} />
                    </SideNavigationIcon>
                    <SideNavigationLabel>{t(topic.title)}</SideNavigationLabel>
                    {index && (
                      <SideNavigationDescription>
                        {t(topic.summary)}
                      </SideNavigationDescription>
                    )}
                    {index && (
                      <SideNavigationEnd>
                        <Icon size="sm" tone="muted" directional>
                          <SettingsIcon name="next" />
                        </Icon>
                      </SideNavigationEnd>
                    )}
                  </SideNavigationLink>
                </SideNavigationItem>
              ))}
          </SideNavigationList>
        </SideNavigationSection>
      ))}
    </SideNavigation>
  );
}
