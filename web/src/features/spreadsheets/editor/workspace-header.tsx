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

import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { DocumentMenu } from "@/features/spreadsheets/document-list/document-menu";
import { SaveStatus } from "@/features/spreadsheets/editor/save-status";
import type { SaveStatus as Status } from "@/features/spreadsheets/model/autosaver";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";

interface WorkspaceHeaderProps {
  name: string;
  status: Status;
  editable: boolean;
  onCommand: (kind: DocumentCommand["kind"]) => void;
  onDownload: (format: "xlsx" | "csv") => void;
}

// The name of the spreadsheet, whether it is saved, and its commands.
export function WorkspaceHeader({
  name,
  status,
  editable,
  onCommand,
  onDownload,
}: WorkspaceHeaderProps) {
  const t = useT();

  return (
    <PageHeader>
      <PageHeaderTitleArea>
        <PageBack render={(props) => <Link {...props} to="/spreadsheets" />}>
          {t("nav.spreadsheets")}
        </PageBack>

        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{name}</PageHeaderHeading>
            <PageHeaderSubheading>
              <SaveStatus status={status} editable={editable} />
            </PageHeaderSubheading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <DocumentMenu
              size="md"
              label={t("spreadsheets.more")}
              onCommand={editable ? onCommand : undefined}
              onDownload={onDownload}
            />
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
