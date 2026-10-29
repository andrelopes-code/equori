import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useTransferTransaction } from "@/features/transactions/api";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

// P5b A28: the category side becomes a posting on another of the owner's accounts; an imported
// other side, when one exists, is paired and voided by the server.
export function TransferDialog({
  transaction,
  accounts,
  open,
  onOpenChange,
}: {
  transaction: Transaction;
  accounts: readonly Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const transfer = useTransferTransaction();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const own = new Set(transaction.postings.map((p) => p.account_id));
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const targets = accounts
    .filter(
      (a) =>
        (a.class === "asset" || a.class === "liability") &&
        a.closed_on === undefined &&
        a.system_role === undefined &&
        !own.has(a.id),
    )
    .sort((a, b) => collator.compare(a.name, b.name));

  const change = useStableCallback((next: boolean) => {
    if (!next) {
      setAccountId(null);
      setError(null);
    }
    onOpenChange(next);
  });
  return (
    <Dialog open={open} onOpenChange={change} size="sm">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transfer.title")}</DialogTitle>
          <DialogDescription>{t("transfer.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field required>
            <FieldLabel>{t("transfer.account")}</FieldLabel>
            <Select
              value={accountId}
              onValueChange={(value) => {
                setAccountId(typeof value === "string" ? value : null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("transfer.choose")} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error !== null && (
            <InlineMessage tone="danger">{error}</InlineMessage>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            tone="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("detail.cancel")}
          </Button>
          <Button
            loading={transfer.isPending}
            disabled={accountId === null}
            onClick={() => {
              if (accountId === null) return;
              setError(null);
              transfer
                .mutateAsync({ current: transaction, accountId })
                .then((result) => {
                  onOpenChange(false);
                  toast.show({
                    tone: "success",
                    title:
                      result.voided_transaction_id === undefined
                        ? t("transfer.done")
                        : t("transfer.paired"),
                  });
                })
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("transfer.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
