import type { components } from "@/api/schema.gen";
import { AccountLedger } from "@/features/accounts/account-ledger";
import { ImportsTab } from "@/features/accounts/imports-tab";
import { PositionsTab } from "@/features/accounts/positions-tab";
import { ReconciliationTab } from "@/features/accounts/reconciliation-tab";
import { ScheduledTab } from "@/features/accounts/scheduled-tab";
import { SyncTab } from "@/features/accounts/sync-tab";
import type {
  AccountSearch,
  AccountTab,
} from "@/features/accounts/account-search";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];
type ExternalAccount = components["schemas"]["ExternalAccount"];

export interface Linked {
  connection: Connection;
  external: ExternalAccount;
}

// One tab's region at a time, mounted only while its tab is chosen (CP-09).
export function AccountTabPanel({
  tab,
  account,
  search,
  linked,
  descendants,
  scale,
}: {
  tab: AccountTab;
  account: Account;
  search: AccountSearch;
  linked: Linked | undefined;
  // Unknown until the account list arrives: whether the account is a leaf decides the columns.
  descendants: Account[] | undefined;
  scale: (code: string) => number;
}) {
  switch (tab) {
    case "activity":
      return descendants === undefined ? null : (
        <AccountLedger
          account={account}
          descendants={descendants}
          search={search}
          scale={scale}
        />
      );
    case "reconciliation":
      return (
        <ReconciliationTab account={account} search={search} scale={scale} />
      );
    case "imports":
      return <ImportsTab account={account} scale={scale} />;
    case "scheduled":
      return <ScheduledTab account={account} scale={scale} />;
    case "positions":
      return descendants === undefined ? null : (
        <PositionsTab descendants={descendants} scale={scale} />
      );
    case "sync":
      return linked === undefined ? null : (
        <SyncTab account={account} linked={linked} />
      );
  }
}
