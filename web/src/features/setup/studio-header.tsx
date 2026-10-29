import { Button } from "@slotted/react/button";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Link } from "@tanstack/react-router";

import { AppearanceToolbar } from "@/features/setup/appearance-toolbar";
import type { ThemeLibrary } from "@/features/setup/use-theme-library";
import { useT } from "@/i18n/i18n-provider";
import { resetAppearance } from "@/theme/appearance";
import { PageBack } from "@/ui/page-back";

export interface StudioHeaderProps {
  library: ThemeLibrary;
}

export function StudioHeader({ library }: StudioHeaderProps) {
  const t = useT();

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageBack
          render={(props) => (
            <Link
              {...props}
              to="/settings"
              search={{ section: "appearance" }}
            />
          )}
        >
          {t("studio.back")}
        </PageBack>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>
              {t("settings.appearance.title")}
            </PageHeaderHeading>
            <PageHeaderSubheading>
              {t("studio.subheading")}
            </PageHeaderSubheading>
          </PageHeaderTitle>
          <PageHeaderActions>
            <AppearanceToolbar library={library} />
            <Button variant="ghost" tone="secondary" onClick={resetAppearance}>
              {t("settings.appearance.reset")}
            </Button>
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
