import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { ButtonLink } from "@slotted/react/button";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { useScale } from "@/features/setup";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

// Complete frontend C1: the card accounts; a single one opens its page.
export function CardsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const spaLink = useSpaLink();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(useApi()));
  const cards = accounts.data?.filter(
    (account) => account.kind === "credit_card",
  );
  const [only] = cards ?? [];
  if (cards?.length === 1 && only !== undefined) {
    return (
      <Navigate
        to="/cards/$accountId"
        params={{ accountId: only.id }}
        replace
      />
    );
  }

  let body;
  if (accounts.isError) {
    body = (
      <QueryError
        error={accounts.error}
        onRetry={() => {
          void accounts.refetch();
        }}
      />
    );
  } else if (cards === undefined || scale === null) {
    body = (
      <SkeletonRegion>
        <Skeleton shape="block" blockSize="8rem" />
      </SkeletonRegion>
    );
  } else if (cards.length === 0) {
    body = (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("cards.list.empty")}</ResultStateTitle>
        </ResultStateContent>
        <ResultStateActions>
          <ButtonLink
            {...spaLink("/accounts")}
            tone="secondary"
            variant="outline"
          >
            {t("cards.list.empty.action")}
          </ButtonLink>
        </ResultStateActions>
      </ResultState>
    );
  } else {
    body = (
      <List variant="ruled" aria-label={t("nav.cards")}>
        {cards.map((card) => {
          const available = card.card?.available_limit;
          return (
            <ListItem key={card.id}>
              <ListItemLink {...spaLink(`/cards/${card.id}`)}>
                <ListItemBody>
                  <ListItemLabel>{card.name}</ListItemLabel>
                  {available !== undefined && (
                    <ListItemDescription>
                      {t("cards.list.available", {
                        amount: formatMoney(
                          available,
                          scale(available.currency),
                          locale,
                        ),
                      })}
                    </ListItemDescription>
                  )}
                </ListItemBody>
              </ListItemLink>
            </ListItem>
          );
        })}
      </List>
    );
  }

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.cards")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>{body}</PageBody>
    </Page>
  );
}
