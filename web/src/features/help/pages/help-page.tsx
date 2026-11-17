import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tag } from "@slotted/react/tag";
import { Link, useParams } from "@tanstack/react-router";

import { HelpNavigation } from "@/features/help/navigation/help-navigation";
import { HelpPageBody } from "@/features/help/article/help-page-body";
import { helpPages, splitHelpPage } from "@/features/help/model/help-pages";
import styles from "@/features/help/pages/help-page.module.css";
import { useHelpPage } from "@/features/help/model/use-help-page";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { usePageWide } from "@/ui/runtime/use-page-wide";

// One help page: its title and kind in the header; from 1024 px of page the pages of the help
// beside it, as the settings page lays its panes.
export function HelpPage() {
  const t = useT();
  const { page } = useParams({ from: "/_authed/help/$page" });
  const query = useHelpPage(page);
  const wide = usePageWide();

  const text = query.data == null ? null : splitHelpPage(query.data);
  const kind = helpPages.find((p) => p.id === page)?.kind;

  const body = (
    <HelpPageBody
      text={text}
      missing={query.isSuccess && query.data === null}
      failed={query.isError}
      page={page}
      onRetry={() => void query.refetch()}
    />
  );

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
                {text?.title ?? t("help.title")}
              </PageHeaderHeading>
              {kind !== undefined && (
                <PageHeaderMarks>
                  <Tag size="sm" tone="secondary">
                    {t(`help.kind.${kind}`)}
                  </Tag>
                </PageHeaderMarks>
              )}
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {wide && (
          <div className={styles.layout}>
            <div className={styles.navigation}>
              <HelpNavigation current={page} />
            </div>
            {body}
          </div>
        )}

        {!wide && body}
      </PageBody>
    </Page>
  );
}
