import { Page } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { AccountFormHeader } from "@/features/accounts/account-form-header";
import { AccountFormPlaceholder } from "@/features/accounts/account-form-placeholder";
import { accountsQuery } from "@/features/accounts/api";
import { NewAccountScreen } from "@/features/accounts/new-account-screen";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

// The form starts from the base currency and the account list, so it waits for both.
export function NewAccountPage() {
  const t = useT();
  const api = useApi();
  const search = useSearch({ from: "/_authed/accounts/new" });
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const scale = useScale();
  const base = settings.data?.base_currency;
  if (
    accounts.data === undefined ||
    base === undefined ||
    instruments.data === undefined ||
    scale === null
  ) {
    return (
      <Page width="wide">
        <AccountFormHeader
          title={t("accountForm.newTitle")}
          subtitle={t("accountForm.newSubtitle")}
          back={{ to: "/accounts" }}
          backLabel={t("nav.accounts")}
        />
        <AccountFormPlaceholder />
      </Page>
    );
  }
  return (
    <NewAccountScreen
      search={search}
      accounts={accounts.data}
      base={base}
      currencies={instruments.data.items
        .filter((i) => i.type === "currency")
        .map((i) => i.code)}
      scale={scale}
    />
  );
}
