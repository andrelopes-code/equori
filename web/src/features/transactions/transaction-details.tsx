import { Badge } from "@slotted/react/badge";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { rowAmount } from "@/features/transactions/row-amount";
import styles from "@/features/transactions/transaction-page.module.css";
import { formatDate, formatDayHeader } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyFigure } from "@/ui/money-figure";
import { MoneyText } from "@/ui/money-text";

type Account = components["schemas"]["Account"];

export function TransactionDetails({
  transaction,
  accounts,
  payees,
  scale,
}: {
  transaction: components["schemas"]["Transaction"];
  accounts: Account[];
  payees: components["schemas"]["Payee"][];
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const voided = transaction.voided_at !== undefined;
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const { money } = rowAmount(transaction, accountsById);
  const amount = (
    <MoneyFigure money={money} scale={scale(money.currency)} size="xl" />
  );
  const payee = payees.find((p) => p.id === transaction.payee_id);
  const words = { today: t("date.today"), yesterday: t("date.yesterday") };
  // Ledger sheet L18: the day and the amount head the record; details follow as ruled pairs.
  return (
    <div className={styles.details}>
      <div className={styles.figure}>
        <Text size="sm" tone="muted">
          {formatDayHeader(transaction.date, today, locale, words)}
        </Text>
        {voided ? <s>{amount}</s> : amount}
        {voided && (
          <div>
            <Badge tone="danger" variant="soft">
              {t("transaction.voided")}
            </Badge>
          </div>
        )}
      </div>
      <DescriptionList
        aria-label={t("transaction.summary")}
        columns={2}
        variant="ruled"
      >
        <DescriptionListItem>
          <DescriptionListTerm>
            {t("transactions.new.date")}
          </DescriptionListTerm>
          <DescriptionListDescription>
            {formatDate(transaction.date, locale)}
          </DescriptionListDescription>
        </DescriptionListItem>
        {payee !== undefined && (
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("transactions.filter.payee")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              {payee.name}
            </DescriptionListDescription>
          </DescriptionListItem>
        )}
        {transaction.tags.length > 0 && (
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("transactions.new.tags")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              {transaction.tags.join(", ")}
            </DescriptionListDescription>
          </DescriptionListItem>
        )}
        <DescriptionListItem>
          <DescriptionListTerm>{t("transaction.origin")}</DescriptionListTerm>
          <DescriptionListDescription>
            {t(`transaction.origin.${transaction.origin}`)}
          </DescriptionListDescription>
        </DescriptionListItem>
        <DescriptionListItem>
          <DescriptionListTerm>{t("transaction.version")}</DescriptionListTerm>
          <DescriptionListDescription>
            {String(transaction.version)}
          </DescriptionListDescription>
        </DescriptionListItem>
        {voided && transaction.void_reason !== undefined && (
          <DescriptionListItem span={2}>
            <DescriptionListTerm>
              {t("transaction.voidReason")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              {transaction.void_reason}
            </DescriptionListDescription>
          </DescriptionListItem>
        )}
      </DescriptionList>
      <Table columns={3}>
        <TableContent>
          <TableCaption>{t("transactions.new.postings")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>
                {t("transaction.column.account")}
              </TableColumnHeader>
              <TableColumnHeader>
                {t("transaction.column.status")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("transactions.column.amount")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {transaction.postings.map((p) => (
              <TableRow key={p.id}>
                <TableRowHeader>
                  <span className={voided ? styles.voided : undefined}>
                    {accountsById.get(p.account_id)?.name ?? p.account_id}
                  </span>
                  {p.memo !== undefined && p.memo !== "" && (
                    <span className={styles.memo}>{p.memo}</span>
                  )}
                </TableRowHeader>
                <TableCell>
                  {p.status !== undefined && (
                    <Badge tone="secondary" variant="soft">
                      {t(`transaction.status.${p.status}`)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell numeric text="nowrap">
                  <span className={voided ? styles.voided : undefined}>
                    <MoneyText
                      money={p.amount}
                      scale={scale(p.amount.currency)}
                    />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </div>
  );
}
