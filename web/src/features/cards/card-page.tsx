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
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError } from "@/api/problem";
import { accountQuery } from "@/features/accounts";
import { CardRecord } from "@/features/cards/card-record";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { PageBack } from "@/ui/page-back";

export function CardPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const { accountId } = useParams({ from: "/_authed/cards/$accountId" });
  const search = useSearch({ from: "/_authed/cards/$accountId" });
  const account = useQuery(accountQuery(api, accountId));
  const scale = useScale();
  const notCard =
    account.data !== undefined && account.data.kind !== "credit_card";
  useEffect(() => {
    if (notCard)
      void navigate({
        to: "/accounts/$id",
        params: { id: accountId },
        replace: true,
      });
  }, [notCard, accountId, navigate]);
  if (account.data !== undefined && scale !== null && !notCard) {
    return <CardRecord account={account.data} search={search} scale={scale} />;
  }
  const notFound =
    account.error instanceof ProblemError && account.error.status === 404;
  // RP-04: the header keeps the way back while the card is missing or failed to load.
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/cards" />}>
            {t("nav.cards")}
          </PageBack>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.cards")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {notFound ? (
          <ResultState status="not-found">
            <ResultStateContent>
              <ResultStateTitle>{t("card.notFound")}</ResultStateTitle>
            </ResultStateContent>
          </ResultState>
        ) : account.isError ? (
          <QueryError
            error={account.error}
            onRetry={() => void account.refetch()}
          />
        ) : (
          <Stack gap={4} aria-busy="true">
            <Skeleton shape="block" blockSize="6rem" />
            <Skeleton shape="block" blockSize="16rem" />
          </Stack>
        )}
      </PageBody>
    </Page>
  );
}
