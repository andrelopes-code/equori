import { useQuery } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { InlineMessage } from "@slotted/react/inline-message";
import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { TagToggle } from "@slotted/react/tag";
import { toast } from "@slotted/react/toast";
import { Heading, Text } from "@slotted/react/typography";

import { useApi } from "@/api/api-context";
import { ProblemError, problemMessage } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, useScale } from "@/features/setup";
import {
  transactionQuery,
  useCategorizeTransaction,
} from "@/features/transactions/api";
import styles from "@/features/transactions/transaction-pane.module.css";
import { transactionRow } from "@/features/transactions/transaction-row";
import { formatDayHeader } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyFigure } from "@/ui/money-figure";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

type Transaction = components["schemas"]["Transaction"];

// Complete frontend T1–T3: the selected transaction beside the table, its category one press away.
export function TransactionPane({ id }: { id: string }) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const api = useApi();
  const spaLink = useSpaLink();
  const scale = useScale();
  const transaction = useQuery(transactionQuery(api, id));
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const categorize = useCategorizeTransaction();

  const failed = transaction.error ?? accounts.error;
  if (failed) {
    return (
      <aside aria-label={t("transactions.pane")} className={styles.pane}>
        <QueryError
          error={failed}
          onRetry={() => {
            void transaction.refetch();
            void accounts.refetch();
          }}
        />
      </aside>
    );
  }
  if (
    transaction.data === undefined ||
    accounts.data === undefined ||
    scale === null
  ) {
    return (
      <aside
        aria-label={t("transactions.pane")}
        aria-busy="true"
        className={styles.pane}
      >
        <SkeletonRegion>
          <Skeleton shape="text" inlineSize="8rem" />
          <Skeleton shape="text" inlineSize="14rem" />
          <Skeleton shape="block" blockSize="3rem" />
        </SkeletonRegion>
      </aside>
    );
  }

  const tx = transaction.data;
  const byID = new Map(accounts.data.map((a) => [a.id, a]));
  const payeeNames = new Map(payees.data?.map((p) => [p.id, p.name]));
  const row = transactionRow(tx, byID, payeeNames);
  const title = row.title === "" ? t("transactions.untitled") : row.title;
  const categoryPostings = tx.postings.filter((p) => {
    const cls = byID.get(p.account_id)?.class;
    return cls === "income" || cls === "expense";
  });
  const categoryClass = byID.get(categoryPostings[0]?.account_id ?? "")?.class;
  const currency =
    categoryPostings[0]?.amount.currency ?? tx.balancing_currency;
  const amount = categoryPostings.reduce((sum, p) => sum + p.amount.amount, 0);
  const current =
    categoryPostings.length === 1 ? categoryPostings[0]?.account_id : undefined;
  const options = accounts.data
    .filter(
      (a) =>
        a.class === categoryClass &&
        a.closed_on === undefined &&
        a.system_role === undefined,
    )
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const voided = tx.voided_at !== undefined;

  const move = async (
    from: Transaction,
    categoryID: string,
  ): Promise<Transaction> =>
    categorize.mutateAsync({
      current: from,
      parts: [{ account_id: categoryID, amount: { amount, currency } }],
    });

  const choose = async (categoryID: string) => {
    if (categoryID === current) return;
    try {
      const next = await move(tx, categoryID);
      const name = byID.get(categoryID)?.name ?? "";
      // The Undo control closes the message it stands in, named by its own id.
      const toastID = `categorized-${tx.id}`;
      toast.show({
        id: toastID,
        title: t("transactions.pane.moved", { title, category: name }),
        duration: 5000,
        actions:
          current === undefined ? undefined : (
            <Button
              tone="secondary"
              variant="outline"
              size="sm"
              onClick={() => {
                toast.dismiss(toastID);
                void move(next, current).catch(() => {
                  toast.show({
                    title: t("transaction.failed"),
                    tone: "danger",
                  });
                });
              }}
            >
              {t("transactions.pane.undo")}
            </Button>
          ),
      });
    } catch (failure) {
      toast.show({
        title:
          failure instanceof ProblemError
            ? problemMessage(failure.problem, t)
            : t("transaction.failed"),
        tone: "danger",
      });
    }
  };

  const account = row.accounts;
  return (
    <aside aria-label={t("transactions.pane")} className={styles.pane}>
      <div className={styles.head}>
        <Text size="sm" tone="muted">
          {formatDayHeader(tx.date, today, locale, {
            today: t("date.today"),
            yesterday: t("date.yesterday"),
          })}
        </Text>
        <Heading level={2} size="lg">
          {title}
        </Heading>
        <span className={voided ? styles.voided : undefined}>
          <MoneyFigure
            money={row.money}
            scale={scale(row.money.currency)}
            size="xl"
          />
        </span>
      </div>
      {row.uncategorized && !voided && (
        <InlineMessage tone="warning">
          {t("transactions.pane.review")}
        </InlineMessage>
      )}
      {options.length > 0 && !voided && (
        <div className={styles.block}>
          <Text size="sm" tone="muted">
            {t("transactions.column.category")}
          </Text>
          <Inline gap={3}>
            {options.map((option) => (
              <TagToggle
                key={option.id}
                variant="outline"
                selected={option.id === current}
                disabled={categorize.isPending}
                onSelectedChange={() => void choose(option.id)}
              >
                {option.name}
              </TagToggle>
            ))}
          </Inline>
        </div>
      )}
      <DescriptionList variant="ruled" aria-label={t("transaction.summary")}>
        {account !== "" && (
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("transaction.column.account")}
            </DescriptionListTerm>
            <DescriptionListDescription>{account}</DescriptionListDescription>
          </DescriptionListItem>
        )}
        <DescriptionListItem>
          <DescriptionListTerm>{t("transaction.origin")}</DescriptionListTerm>
          <DescriptionListDescription>
            {t(`transaction.origin.${tx.origin}`)}
          </DescriptionListDescription>
        </DescriptionListItem>
        {tx.tags.length > 0 && (
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("transactions.new.tags")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              {tx.tags.join(", ")}
            </DescriptionListDescription>
          </DescriptionListItem>
        )}
      </DescriptionList>
      <Inline gap={6}>
        <Text size="sm">
          <Link {...spaLink(`/transactions/${tx.id}`)} variant="neutral">
            {t("transactions.pane.open")}
          </Link>
        </Text>
        {!voided && (
          <Text size="sm">
            <Link
              {...spaLink(`/transactions/${tx.id}/correct`)}
              variant="neutral"
            >
              {t("transaction.actions.correct")}
            </Link>
          </Text>
        )}
      </Inline>
    </aside>
  );
}
