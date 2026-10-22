import { Highlight } from "@slotted/react/highlight";

import type { components } from "@/api/schema.gen";
import { AccountAvatar } from "@/features/accounts/account-avatar";

type Account = components["schemas"]["Account"];

// A candidate parent in the picker: its own mark, so a wallet reads as a wallet and a bank account
// shows its bank, beside the name, the kind and what it already holds. The parts carry the
// data-part-* attributes the family lays out (Slotted finding "renderOption example sets
// data-part, the layout reads data-part-*").
export function ParentOption({
  account,
  kind,
  holds,
  query,
}: {
  account: Account;
  kind: string;
  holds: string | undefined;
  query: string;
}) {
  return (
    <>
      <span data-part="media" data-part-media="">
        <AccountAvatar account={account} size="sm" />
      </span>
      <span data-part="label" data-part-label="">
        <Highlight text={account.name} query={query} />
      </span>
      <span data-part="description" data-part-description="">
        {kind}
      </span>
      {holds !== undefined && (
        <span data-part="meta" data-part-meta="">
          {holds}
        </span>
      )}
    </>
  );
}
