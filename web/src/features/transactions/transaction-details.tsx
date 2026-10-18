import { Badge } from "@slotted/react/badge";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";

import type { components } from "@/api/schema.gen";
import { rowAmount } from "@/features/transactions/row-amount";
import styles from "@/features/transactions/transaction-page.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
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
  const voided = transaction.voided_at !== undefined;
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const { money } = rowAmount(transaction, accountsById);
  const amount = (
    <MoneyText money={money} scale={scale(money.currency)} tone="flow" />
  );
  const payee = payees.find((p) => p.id === transaction.payee_id);
  return (
    <div className={styles.details}>
      {voided && (
        <div>
          <Badge tone="danger" variant="soft">
            {t("transaction.voided")}
          </Badge>
        </div>
      )}
      <DescriptionList aria-label={t("transaction.summary")} columns={2}>
        <DescriptionListItem>
          <DescriptionListTerm>
            {t("transactions.new.amount")}
          </DescriptionListTerm>
          <DescriptionListDescription>
            {voided ? <s>{amount}</s> : amount}
          </DescriptionListDescription>
        </DescriptionListItem>
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
      <List variant="ruled" aria-label={t("transactions.new.postings")}>
        {transaction.postings.map((p) => (
          <ListItem key={p.id}>
            <ListItemBody>
              <ListItemLabel className={voided ? styles.voided : ""}>
                {accountsById.get(p.account_id)?.name ?? p.account_id}
              </ListItemLabel>
              {p.memo !== undefined && p.memo !== "" && (
                <ListItemDescription>{p.memo}</ListItemDescription>
              )}
            </ListItemBody>
            <ListItemEnd>
              <span className={styles.postingEnd}>
                {p.status !== undefined && (
                  <Badge tone="secondary" variant="soft">
                    {t(`transaction.status.${p.status}`)}
                  </Badge>
                )}
                <span className={voided ? styles.voided : ""}>
                  <MoneyText
                    money={p.amount}
                    scale={scale(p.amount.currency)}
                  />
                </span>
              </span>
            </ListItemEnd>
          </ListItem>
        ))}
      </List>
    </div>
  );
}
