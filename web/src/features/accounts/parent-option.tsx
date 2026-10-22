import {
  EntityPickerOptionDescription,
  EntityPickerOptionLabel,
  EntityPickerOptionMedia,
  EntityPickerOptionMeta,
} from "@slotted/react/entity-picker";
import { Highlight } from "@slotted/react/highlight";

import type { components } from "@/api/schema.gen";
import { AccountAvatar } from "@/features/accounts/account-avatar";

type Account = components["schemas"]["Account"];

// A candidate parent in the picker: its own mark, so a wallet reads as a wallet and a bank account
// shows its bank, beside the name, the kind and what it already holds.
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
      <EntityPickerOptionMedia>
        <AccountAvatar account={account} size="sm" />
      </EntityPickerOptionMedia>
      <EntityPickerOptionLabel>
        <Highlight text={account.name} query={query} />
      </EntityPickerOptionLabel>
      <EntityPickerOptionDescription>{kind}</EntityPickerOptionDescription>
      {holds !== undefined && (
        <EntityPickerOptionMeta>{holds}</EntityPickerOptionMeta>
      )}
    </>
  );
}
