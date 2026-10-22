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
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { balanceQuery, useCloseAccount } from "@/features/accounts/api";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Account = components["schemas"]["Account"];

// A74: closing an account closes its open descendants; a balance account needs a zero balance and
// no postings after the date. The dialog names both before the reader confirms (FM-14).
export function CloseAccountDialog({
  account,
  descendants,
  scale,
  onDone,
  onCancel,
}: {
  account: Account;
  descendants: Account[];
  scale: (code: string) => number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const [locale] = useAppLocale();
  const today = useToday();
  const api = useApi();
  const close = useCloseAccount();
  const [date, setDate] = useState(today);
  const [error, setError] = useState<{
    text: string;
    notEmpty: boolean;
  } | null>(null);
  const balance = useQuery({
    ...balanceQuery(api, account.id, date, "booked"),
    enabled: error?.notEmpty === true,
  });
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const open = descendants.filter((d) => d.closed_on === undefined);
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("account.closeTitle", { name: account.name })}
          </DialogTitle>
          <DialogDescription>{t("account.closeHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Field>
              <FieldLabel>{t("account.closeDate")}</FieldLabel>
              <DateInput name="closed_on" value={date} onChange={setDate} />
            </Field>
            {open.length > 0 && (
              <Text size="sm">
                {t("account.closeDescendants", {
                  names: open.map((d) => d.name).join(", "),
                })}
              </Text>
            )}
            {error !== null && (
              <InlineMessage tone="danger">
                {error.text}
                {error.notEmpty && balance.data !== undefined && (
                  <>
                    {" "}
                    {t("account.balanceOn", {
                      date: formatDate(date, locale),
                      amount: formatMoney(
                        balance.data.balance,
                        scale(balance.data.balance.currency),
                        locale,
                      ),
                    })}
                  </>
                )}
              </InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={close.isPending}
            onClick={() => {
              setError(null);
              close
                .mutateAsync({ id: account.id, closedOn: date })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError({
                    text: errorText(caught, t),
                    notEmpty:
                      caught instanceof ProblemError &&
                      caught.problem.code === "account_not_empty",
                  });
                });
            }}
          >
            {t("account.closeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
