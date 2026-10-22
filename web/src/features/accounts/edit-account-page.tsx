import { Page } from "@slotted/react/page";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { ProblemError } from "@/api/problem";
import { AccountFormHeader } from "@/features/accounts/account-form-header";
import { AccountFormPlaceholder } from "@/features/accounts/account-form-placeholder";
import { accountQuery, accountsQuery } from "@/features/accounts/api";
import { EditAccountScreen } from "@/features/accounts/edit-account-screen";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

export function EditAccountPage() {
  const t = useT();
  const api = useApi();
  const { id } = useParams({ from: "/_authed/accounts/$id/edit" });
  const account = useQuery(accountQuery(api, id));
  const accounts = useQuery(accountsQuery(api));
  const scale = useScale();
  if (
    account.data !== undefined &&
    accounts.data !== undefined &&
    scale !== null
  ) {
    return (
      <EditAccountScreen
        key={account.data.id}
        account={account.data}
        accounts={accounts.data}
        scale={scale}
      />
    );
  }
  const notFound =
    account.error instanceof ProblemError && account.error.status === 404;
  return (
    <Page width="wide">
      <AccountFormHeader
        title={t("accountForm.editTitle")}
        subtitle={t("accountForm.editSubtitle")}
        back={{ to: "/accounts" }}
        backLabel={t("nav.accounts")}
      />
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
        <AccountFormPlaceholder />
      )}
    </Page>
  );
}
