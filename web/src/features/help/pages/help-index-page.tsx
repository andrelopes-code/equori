import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { HelpIndexBlocks } from "@/features/help/index/help-index-blocks";
import { helpLibraryQuery } from "@/features/help/model/help-library";
import { HelpFound } from "@/features/help/search/help-found";
import { HelpSearch } from "@/features/help/search/help-search";
import { useHelpSearch } from "@/features/help/search/use-help-search";
import styles from "@/features/help/styles/help.module.css";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

// The index of the help: the search first, then where to start, the pages by area of the app,
// the symptoms and the glossary (spec 2026-11-17-help-design, HP1).
export function HelpIndexPage() {
  const t = useT();
  const { locale } = useAppLocaleState();
  const { q } = useSearch({ from: "/_authed/help" });
  const library = useQuery(helpLibraryQuery(locale.language, locale.region));
  const query = q ?? "";
  const search = useHelpSearch(library.data, query);

  const searching = query.trim() !== "" && library.data !== undefined;

  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("help.title")}</PageHeaderHeading>
              <PageHeaderSubheading>{t("help.subtitle")}</PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {library.isError && (
          <ResultState status="error">
            <ResultStateContent>
              <ResultStateTitle>{t("help.loadFailed")}</ResultStateTitle>
            </ResultStateContent>
            <ResultStateActions>
              <Button
                variant="outline"
                tone="secondary"
                onClick={() => void library.refetch()}
              >
                {t("transactions.tryAgain")}
              </Button>
            </ResultStateActions>
          </ResultState>
        )}

        {!library.isError && (
          <div className={styles.help}>
            <HelpSearch
              query={query}
              onQueryChange={search.setQuery}
              focus={q !== undefined}
              onKeyDown={search.onKeyDown}
            />

            {searching && (
              <HelpFound
                library={library.data}
                result={search.result}
                active={search.active}
              />
            )}
            {!searching && <HelpIndexBlocks library={library.data} />}
          </div>
        )}
      </PageBody>
    </Page>
  );
}
