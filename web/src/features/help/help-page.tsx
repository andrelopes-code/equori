import { Button } from "@slotted/react/button";
import { Markdown } from "@slotted/react/markdown";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Link, useParams } from "@tanstack/react-router";

import { splitHelpPage } from "@/features/help/help-pages";
import { useHelpPage } from "@/features/help/use-help-page";
import { useT } from "@/i18n/i18n-provider";
import { screenLinks } from "@/navigation/screen-links";
import { PageBack } from "@/ui/page-back";

export function HelpPage() {
  const t = useT();
  const { page } = useParams({ from: "/_authed/help/$page" });
  const query = useHelpPage(page);

  const text = query.data == null ? null : splitHelpPage(query.data);
  const missing = query.isSuccess && query.data === null;

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
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {text !== null && (
          <Markdown
            source={text.body}
            headingOffset={1}
            renderers={screenLinks}
          />
        )}

        {missing && (
          <ResultState status="not-found">
            <ResultStateContent>
              <ResultStateTitle>{t("help.notFound")}</ResultStateTitle>
              <ResultStateDescription>
                {t("help.notFoundHint")}
              </ResultStateDescription>
            </ResultStateContent>
          </ResultState>
        )}

        {query.isError && (
          <ResultState status="error">
            <ResultStateContent>
              <ResultStateTitle>{t("help.loadFailed")}</ResultStateTitle>
            </ResultStateContent>
            <ResultStateActions>
              <Button
                variant="outline"
                tone="secondary"
                onClick={() => void query.refetch()}
              >
                {t("transactions.tryAgain")}
              </Button>
            </ResultStateActions>
          </ResultState>
        )}
      </PageBody>
    </Page>
  );
}
