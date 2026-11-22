import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useIdleCash } from "@/features/accounts/account-record/use-idle-cash";
import { useCloseAccount } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

interface IdleCashNoticeProps {
  account: Account;
}

// BC19: a brokerage that pays from the account of its institution still holds a cash account with
// no entry, so every trade asks which one pays. The action closes that cash account.
export function IdleCashNotice({ account }: IdleCashNoticeProps) {
  const t = useT();
  const today = useToday();
  const idle = useIdleCash(account);
  const close = useCloseAccount();

  if (idle === null) return null;

  const { cash, paying } = idle;
  const message =
    close.error === null
      ? t("brokerage.idleCash", { cash: cash.name, account: paying.name })
      : errorText(close.error, t);

  function handleClose() {
    close.mutate(
      { id: cash.id, closedOn: today },
      {
        onSuccess: () => {
          toast.show({
            tone: "success",
            title: t("account.closed", { name: cash.name }),
          });
        },
      },
    );
  }

  return (
    <Alert tone="info" live="polite">
      <AlertContent>
        <AlertDescription>{message}</AlertDescription>
      </AlertContent>

      <AlertActions>
        <Button loading={close.isPending} onClick={handleClose}>
          {t("brokerage.closeIdleCash", { cash: cash.name })}
        </Button>
      </AlertActions>
    </Alert>
  );
}
