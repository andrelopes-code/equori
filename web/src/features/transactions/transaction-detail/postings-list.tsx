import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { postingDetail } from "@/features/transactions/transaction-detail/posting-detail";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";
import { StatementItem } from "@/ui/statement/statement-item";
import { StatementList } from "@/ui/statement/statement-list";

type Account = components["schemas"]["Account"];
type Posting = components["schemas"]["Posting"];

interface PostingsListProps {
  postings: readonly Posting[];
  accounts: Map<string, Account>;
  scale: (code: string) => number;
}

// Below 600 px the accounts a transaction moved read as statement rows; a row opens its account
// (spec 2026-11-21-mobile-transaction-detail, MD5).
export function PostingsList({ postings, accounts, scale }: PostingsListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const amountTone = useAmountTone();
  const navigate = useNavigate();

  return (
    <StatementList label={t("postings.caption")}>
      {postings.map((posting) => (
        <StatementItem
          key={posting.id}
          mark={undefined}
          title={
            accounts.get(posting.account_id)?.name ??
            t("postings.unknownAccount")
          }
          struck={false}
          flag={
            posting.status === "pending" && (
              <Text size="sm" weight="medium" tone="warning">
                {t("posting.status.pending")}
              </Text>
            )
          }
          detail={postingDetail(posting, t, locale)}
          amount={
            <Text
              weight="semibold"
              numeric="tabular"
              tone={amountTone("flow", directionOf(posting.amount.amount))}
            >
              {fmt.signed(posting.amount, scale(posting.amount.currency))}
            </Text>
          }
          note={
            posting.original !== undefined && (
              <Text size="sm" tone="muted" numeric="tabular">
                {t("transaction.facts.original", {
                  amount: fmt.money(
                    posting.original,
                    scale(posting.original.currency),
                  ),
                })}
              </Text>
            )
          }
          onOpen={() => {
            void navigate({
              to: "/accounts/$id",
              params: { id: posting.account_id },
            });
          }}
          selection={undefined}
        />
      ))}
    </StatementList>
  );
}
