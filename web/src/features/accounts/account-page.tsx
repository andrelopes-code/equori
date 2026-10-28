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
import { AccountRecord } from "@/features/accounts/account-record";
import { accountQuery } from "@/features/accounts/api";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { PageBack } from "@/ui/page-back";

export function AccountPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const { id } = useParams({ from: "/_authed/accounts/$id" });
  const search = useSearch({ from: "/_authed/accounts/$id" });
  const account = useQuery(accountQuery(api, id));
  const scale = useScale();
  const isCard = account.data?.kind === "credit_card";
  useEffect(() => {
    if (isCard) {
      void navigate({
        to: "/cards/$accountId",
        params: { accountId: id },
        replace: true,
      });
    }
  }, [isCard, id, navigate]);

  if (account.data !== undefined && scale !== null && !isCard) {
    return (
      <AccountRecord account={account.data} search={search} scale={scale} />
    );
  }
  const notFound =
    account.error instanceof ProblemError && account.error.status === 404;
  // RP-04: the header keeps the way back while the record is missing or failed to load.
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/accounts" />}>
            {t("nav.accounts")}
          </PageBack>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {account.isPending ? (
                  <Skeleton shape="text" inlineSize="12rem" />
                ) : (
                  t("nav.accounts")
                )}
              </PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {notFound ? (
          <ResultState status="not-found">
            <ResultStateContent>
              <ResultStateTitle>{t("account.notFound")}</ResultStateTitle>
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
