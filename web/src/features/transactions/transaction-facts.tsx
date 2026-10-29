import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";

import type { components } from "@/api/schema.gen";
import { IncomeFacts } from "@/features/transactions/income-facts";
import { TradeFacts } from "@/features/transactions/trade-facts";
import { CategorizationText } from "@/features/transactions/categorization-text";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

const originWords: Record<Transaction["origin"], MessageKey> = {
  manual: "origin.manual",
  import: "origin.import",
  schedule: "origin.schedule",
  system: "origin.system",
};

export function TransactionFacts({
  transaction,
  payee,
}: {
  transaction: Transaction;
  payee: string | undefined;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <DescriptionList layout="stack">
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.date")}</DescriptionListTerm>
        <DescriptionListDescription>
          {formatDate(transaction.date, locale)}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.payee")}</DescriptionListTerm>
        <DescriptionListDescription>{payee}</DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.description")}</DescriptionListTerm>
        <DescriptionListDescription copy={transaction.description !== ""}>
          {transaction.description || undefined}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.tags")}</DescriptionListTerm>
        <DescriptionListDescription>
          {transaction.tags.length === 0 ? undefined : (
            <Inline gap={4}>
              {transaction.tags.map((tag) => (
                <Tag key={tag} size="sm">
                  {tag}
                </Tag>
              ))}
            </Inline>
          )}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.categorized")}</DescriptionListTerm>
        <DescriptionListDescription>
          <CategorizationText id={transaction.id} />
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.origin")}</DescriptionListTerm>
        <DescriptionListDescription>
          {t(originWords[transaction.origin])}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("facts.version")}</DescriptionListTerm>
        <DescriptionListDescription>
          {String(transaction.version)}
        </DescriptionListDescription>
      </DescriptionListItem>
      {transaction.trade !== undefined && (
        <TradeFacts trade={transaction.trade} />
      )}
      {transaction.investment_income !== undefined && (
        <IncomeFacts income={transaction.investment_income} />
      )}
    </DescriptionList>
  );
}
