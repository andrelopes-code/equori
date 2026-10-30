import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { toast } from "@slotted/react/toast";
import { Heading } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { creditLimitsQuery } from "@/features/cards/api";
import { CreditLimitDialog } from "@/features/cards/credit-limit-dialog";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

interface CreditLimitSectionProps {
  account: Account;
  scale: (code: string) => number;
}

// T05: the versions of the card's credit limit, newest first.
export function CreditLimitSection({
  account,
  scale,
}: CreditLimitSectionProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const limits = useQuery(creditLimitsQuery(useApi(), account.id));

  const [open, setOpen] = useState(false);

  const sorted = [...(limits.data ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );

  return (
    <Stack gap={3}>
      <Inline justify="between" gap={3}>
        <Heading level={2} size="md">
          {t("accountForm.limitGroup")}
        </Heading>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t("card.newLimit")}
        </Button>
      </Inline>

      {open && (
        <CreditLimitDialog
          accountId={account.id}
          currency={account.currency}
          scale={scale(account.currency)}
          onCancel={() => {
            setOpen(false);
          }}
          onDone={() => {
            setOpen(false);
            toast.show({ tone: "success", title: t("card.limitSaved") });
          }}
        />
      )}

      <Table columns={2} variant="framed">
        <TableContent>
          <TableCaption>{t("card.limitVersions")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("card.limitFrom")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("accountForm.limit")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          {limits.isPending ? (
            <TableLoader skeletonRows={1} />
          ) : (
            <TableBody>
              {sorted.length === 0 && (
                <TableEmpty>{t("cards.limitNone")}</TableEmpty>
              )}
              {sorted.map((limit) => (
                <TableRow
                  key={limit.effective_from}
                  value={limit.effective_from}
                >
                  <TableRowHeader>
                    {formatDate(limit.effective_from, locale)}
                  </TableRowHeader>
                  <TableCell numeric>
                    {fmt.money(limit.amount, scale(limit.amount.currency))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
