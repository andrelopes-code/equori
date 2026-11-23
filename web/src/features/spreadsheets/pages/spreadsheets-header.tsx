import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/navigation/header-action";

interface SpreadsheetsHeaderProps {
  canCreate: boolean;
  creating: boolean;
  onCreate: () => void;
}

export function SpreadsheetsHeader({
  canCreate,
  creating,
  onCreate,
}: SpreadsheetsHeaderProps) {
  const t = useT();

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("spreadsheets.title")}</PageHeaderHeading>
            <PageHeaderSubheading>
              {t("spreadsheets.subtitle")}
            </PageHeaderSubheading>
          </PageHeaderTitle>

          {canCreate && (
            <PageHeaderActions>
              <HeaderAction
                primary
                label={t("spreadsheets.new")}
                glyph="plus"
                loading={creating}
                onClick={onCreate}
              />
            </PageHeaderActions>
          )}
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
