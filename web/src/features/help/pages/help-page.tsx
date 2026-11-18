import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tag } from "@slotted/react/tag";
import { Link, useParams } from "@tanstack/react-router";

import { HelpPageBody } from "@/features/help/article/help-page-body";
import { HelpPageActions } from "@/features/help/header/help-page-actions";
import { helpPages } from "@/features/help/model/help-pages";
import { parseHelpPage } from "@/features/help/model/parse-help-page";
import { useHelpPage } from "@/features/help/model/use-help-page";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

// One help page: its title and kind in the header, with the search and the screen of the task.
export function HelpPage() {
  const t = useT();
  const { page } = useParams({ from: "/_authed/help/$page" });
  const query = useHelpPage(page);
  const phone = useMediaQuery(compactQuery);

  const document = query.data == null ? null : parseHelpPage(query.data);
  const kind = helpPages.find((p) => p.id === page)?.kind;

  return (
    <Page width="full">
      <PageHeader size="lg" loading={query.isPending}>
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/help" />}>
            {t("help.title")}
          </PageBack>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {document?.title ?? t("help.title")}
              </PageHeaderHeading>
              {kind !== undefined && (
                <PageHeaderMarks>
                  <Tag size="sm" tone="secondary">
                    {t(`help.kind.${kind}`)}
                  </Tag>
                </PageHeaderMarks>
              )}
            </PageHeaderTitle>
            {!phone && (
              <PageHeaderActions>
                <HelpPageActions page={page} />
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <HelpPageBody
          document={document}
          missing={query.isSuccess && query.data === null}
          failed={query.isError}
          page={page}
          onRetry={() => void query.refetch()}
        />
      </PageBody>
    </Page>
  );
}
