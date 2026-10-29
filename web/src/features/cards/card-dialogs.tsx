import { toast } from "@slotted/react/toast";

import type { components } from "@/api/schema.gen";
import { CloseAccountDialog, ReopenAccountDialog } from "@/features/accounts";
import { InstallmentPurchaseDialog } from "@/features/cards/installment-purchase-dialog";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

export type CardDialog = "installments" | "close" | "reopen";

interface CardDialogsProps {
  dialog: CardDialog | null;
  account: Account;
  scale: (code: string) => number;
  onDismiss: () => void;
}

// The dialogs of a card's page: a purchase in installments, close and reopen.
export function CardDialogs({
  dialog,
  account,
  scale,
  onDismiss,
}: CardDialogsProps) {
  const t = useT();

  return (
    <>
      <Presence value={dialog === "installments" ? dialog : undefined}>
        {() => (
          <InstallmentPurchaseDialog
            account={account}
            scale={scale(account.currency)}
            onCancel={onDismiss}
            onDone={() => {
              onDismiss();
              toast.show({ tone: "success", title: t("installments.done") });
            }}
          />
        )}
      </Presence>

      <Presence value={dialog === "close" ? dialog : undefined}>
        {() => (
          <CloseAccountDialog
            account={account}
            descendants={[]}
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
            ancestors={[]}
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
    </>
  );
}
