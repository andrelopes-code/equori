import { toast } from "@slotted/react/toast";

import type { components } from "@/api/schema.gen";
import { CloseAccountDialog } from "@/features/accounts/close-account-dialog";
import { ReopenAccountDialog } from "@/features/accounts/reopen-account-dialog";
import { UnlockDialog } from "@/features/accounts/unlock-dialog";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

export type AccountDialog = "close" | "reopen" | "unlock";

interface AccountDialogsProps {
  dialog: AccountDialog | null;
  account: Account;
  ancestors: Account[];
  descendants: Account[];
  lastReconciled: string | undefined;
  scale: (code: string) => number;
  onDismiss: () => void;
}

// The dialogs of an account's page: close, reopen and unlock.
export function AccountDialogs({
  dialog,
  account,
  ancestors,
  descendants,
  lastReconciled,
  scale,
  onDismiss,
}: AccountDialogsProps) {
  const t = useT();

  return (
    <>
      <Presence value={dialog === "close" ? dialog : undefined}>
        {() => (
          <CloseAccountDialog
            account={account}
            descendants={descendants}
            scale={scale}
            onCancel={onDismiss}
            onDone={() => {
              onDismiss();
              toast.show({
                tone: "success",
                title: t("account.closed", { name: account.name }),
              });
            }}
          />
        )}
      </Presence>

      <Presence value={dialog === "reopen" ? dialog : undefined}>
        {() => (
          <ReopenAccountDialog
            account={account}
            ancestors={ancestors}
            onCancel={onDismiss}
            onDone={() => {
              onDismiss();
              toast.show({
                tone: "success",
                title: t("account.reopened", { name: account.name }),
              });
            }}
          />
        )}
      </Presence>

      <Presence value={dialog === "unlock" ? dialog : undefined}>
        {() => (
          <UnlockDialog
            account={account}
            lastReconciled={lastReconciled}
            onCancel={onDismiss}
            onDone={() => {
              onDismiss();
              toast.show({ tone: "success", title: t("unlock.done") });
            }}
          />
        )}
      </Presence>
    </>
  );
}
