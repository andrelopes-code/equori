import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { Button, ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { useApi } from "@/api/api-context";
import {
  billingRulesQuery,
  cardAccountQuery,
  statementsQuery,
} from "@/features/cards/api";
import styles from "@/features/cards/card-overview-page.module.css";
import { CardStats } from "@/features/cards/card-stats";
import { CurrentStatementCard } from "@/features/cards/current-statement-card";
import { MissingRuleMessage } from "@/features/cards/missing-rule-message";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { groupStatements } from "@/features/cards/statement-groups";
import type { Statement } from "@/features/cards/statement-groups";
import { StatementList } from "@/features/cards/statement-list";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

function payable(statement: Statement): boolean {
  return statement.unpaid.amount > 0 && statement.status !== "financed";
}

export function CardOverviewPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const spaLink = useSpaLink();
  const viewport = useViewport();
  const { accountId = "" } = useParams({ strict: false });
  const { from: searchFrom } = useSearch({ strict: false });
  const from = searchFrom ?? addMonths(currentMonth(today), -12);
  const account = useQuery(cardAccountQuery(api, accountId));
  const statements = useQuery(statementsQuery(api, accountId, from));
  const rules = useQuery(billingRulesQuery(api, accountId));
  const queries = [account, statements, rules];
  const failed = queries.find((query) => query.isError);

  let body;
  if (failed?.error) {
    body = (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const query of queries) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  } else if (
    account.data === undefined ||
    statements.data === undefined ||
    rules.data === undefined
  ) {
    body = (
      <SkeletonRegion>
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} shape="text" inlineSize="60%" />
        ))}
      </SkeletonRegion>
    );
  } else {
    const phone = viewport === "phone";
    const { current, upcoming, past } = groupStatements(statements.data);
    const overdue = statements.data.find(
      (s) => s.status === "overdue" && payable(s),
    );
    const payTarget =
      overdue ??
      (current !== undefined && payable(current) ? current : undefined);
    const stats = <CardStats account={account.data} compact={phone} />;
    const currentCard =
      current === undefined ? null : (
        <CurrentStatementCard statement={current} />
      );
    body = (
      <div className={styles.stack}>
        <div className={styles.actions}>
          <ButtonLink {...spaLink(`/transactions/new?account_id=${accountId}`)}>
            {t("cards.action.purchase")}
          </ButtonLink>
          {rules.data.length === 0 ? (
            <Button tone="secondary" variant="outline" disabled>
              {t("cards.action.installment")}
            </Button>
          ) : (
            <ButtonLink
              tone="secondary"
              variant="outline"
              {...spaLink(`/cards/${accountId}/purchases/new`)}
            >
              {t("cards.action.installment")}
            </ButtonLink>
          )}
          {payTarget !== undefined && (
            <ButtonLink
              tone="secondary"
              variant="outline"
              {...spaLink(`/cards/${accountId}/statements/${payTarget.id}/pay`)}
            >
              {t("cards.action.pay")}
            </ButtonLink>
          )}
          <ButtonLink
            tone="secondary"
            variant="ghost"
            {...spaLink(`/cards/${accountId}/settings`)}
          >
            {t("cards.action.settings")}
          </ButtonLink>
        </div>
        {rules.data.length === 0 && (
          <MissingRuleMessage accountId={accountId} />
        )}
        {phone ? currentCard : stats}
        {phone ? stats : currentCard}
        <StatementList accountId={accountId} upcoming={upcoming} past={past} />
        <div className={styles.actions}>
          <ButtonLink
            tone="secondary"
            variant="ghost"
            {...spaLink(`/cards/${accountId}?from=${addMonths(from, -12)}`)}
          >
            {t("cards.action.earlier")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {account.data?.name ?? t("cards.title")}
              </PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>{body}</PageBody>
    </Page>
  );
}
