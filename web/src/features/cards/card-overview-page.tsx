import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderArea,
  PageHeaderContent,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { useApi } from "@/api/api-context";
import {
  billingRulesQuery,
  cardAccountQuery,
  statementsQuery,
} from "@/features/cards/api";
import { CardFigures } from "@/features/cards/card-figures";
import { CardMenu } from "@/features/cards/card-menu";
import styles from "@/features/cards/card-overview-page.module.css";
import { CommitmentsTable } from "@/features/cards/commitments-table";
import { EarlierStatementsTable } from "@/features/cards/earlier-statements-table";
import { MissingRuleMessage } from "@/features/cards/missing-rule-message";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { groupStatements } from "@/features/cards/statement-groups";
import type { Statement } from "@/features/cards/statement-groups";
import { StatementLinesTable } from "@/features/cards/statement-lines-table";
import { StatementStatusTag } from "@/features/cards/statement-status-tag";
import { useScale } from "@/features/setup";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

function payable(statement: Statement): boolean {
  return statement.unpaid.amount > 0 && statement.status !== "financed";
}

// Complete frontend C2 and C3. The header reads the open statement, or the latest one
// without it.
export function CardOverviewPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const spaLink = useSpaLink();
  const scale = useScale();
  const { accountId = "" } = useParams({ strict: false });
  const { from: searchFrom } = useSearch({ strict: false });
  const from = searchFrom ?? addMonths(currentMonth(today), -12);
  const account = useQuery(cardAccountQuery(api, accountId));
  const statements = useQuery(statementsQuery(api, accountId, from));
  const rules = useQuery(billingRulesQuery(api, accountId));
  const queries = [account, statements, rules];
  const failed = queries.find((query) => query.isError);
  const loaded =
    account.data !== undefined &&
    statements.data !== undefined &&
    rules.data !== undefined &&
    scale !== null;

  const groups =
    statements.data === undefined
      ? undefined
      : groupStatements(statements.data);
  const focus = groups?.current ?? groups?.past[0];
  const earlier =
    groups === undefined
      ? []
      : groups.past.filter((statement) => statement !== focus);
  const overdue = statements.data?.find(
    (s) => s.status === "overdue" && payable(s),
  );
  const payTarget =
    overdue ??
    (groups?.current !== undefined && payable(groups.current)
      ? groups.current
      : undefined);

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
  } else if (!loaded) {
    body = (
      <SkeletonRegion>
        <Skeleton shape="block" blockSize="12rem" />
      </SkeletonRegion>
    );
  } else {
    body = (
      <div className={styles.layout}>
        {rules.data.length === 0 && (
          <div className={styles.full}>
            <MissingRuleMessage accountId={accountId} />
          </div>
        )}
        {focus === undefined ? (
          <div className={styles.full}>
            <ResultState status="empty" reach="section">
              <ResultStateContent>
                <ResultStateTitle>{t("cards.none")}</ResultStateTitle>
              </ResultStateContent>
            </ResultState>
          </div>
        ) : (
          <>
            <Section>
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t("cards.lines")}</SectionHeading>
                </SectionTitle>
              </SectionHeader>
              <SectionBody>
                <StatementLinesTable
                  statement={focus}
                  scale={scale(focus.amount_due.currency)}
                />
              </SectionBody>
            </Section>
            <Section>
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t("cards.committed")}</SectionHeading>
                </SectionTitle>
              </SectionHeader>
              <SectionBody>
                <CommitmentsTable
                  accountId={accountId}
                  reference={focus.reference}
                  scale={scale(focus.amount_due.currency)}
                />
              </SectionBody>
            </Section>
          </>
        )}
        <div className={styles.full}>
          <Section>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("cards.earlier")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <div className={styles.stack}>
                {earlier.length > 0 && (
                  <EarlierStatementsTable
                    accountId={accountId}
                    statements={earlier}
                    scale={scale}
                  />
                )}
                <div>
                  <ButtonLink
                    tone="secondary"
                    variant="ghost"
                    size="sm"
                    {...spaLink(
                      `/cards/${accountId}?from=${addMonths(from, -12)}`,
                    )}
                  >
                    {t("cards.action.earlier")}
                  </ButtonLink>
                </div>
              </div>
            </SectionBody>
          </Section>
        </div>
      </div>
    );
  }

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {account.data?.name ?? t("cards.title")}
              </PageHeaderHeading>
              {focus !== undefined && (
                <PageHeaderMarks>
                  <StatementStatusTag status={focus.status} />
                </PageHeaderMarks>
              )}
              {focus !== undefined && (
                <PageHeaderSubheading>
                  {t("cards.header.statement", {
                    month: formatReferenceMonth(focus.reference, locale),
                  })}
                </PageHeaderSubheading>
              )}
            </PageHeaderTitle>
            {loaded && (
              <PageHeaderActions>
                <ButtonLink
                  size="md"
                  {...spaLink(`/transactions/new?account_id=${accountId}`)}
                >
                  {t("cards.action.purchase")}
                </ButtonLink>
                {payTarget !== undefined && (
                  <ButtonLink
                    tone="secondary"
                    variant="outline"
                    size="md"
                    {...spaLink(
                      `/cards/${accountId}/statements/${payTarget.id}/pay`,
                    )}
                  >
                    {t("cards.action.pay")}
                  </ButtonLink>
                )}
                <CardMenu
                  accountId={accountId}
                  installments={rules.data.length > 0}
                />
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        {loaded && focus !== undefined && (
          <PageHeaderArea>
            <PageHeaderContent>
              <CardFigures
                account={account.data}
                statement={focus}
                scale={scale}
              />
            </PageHeaderContent>
          </PageHeaderArea>
        )}
      </PageHeader>
      <PageBody>{body}</PageBody>
    </Page>
  );
}
