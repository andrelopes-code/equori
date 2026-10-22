import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  AccountCard,
  accountCardColor,
  logoIndexQuery,
  logoURL,
} from "@/features/accounts";
import { flowsQuery } from "@/features/cards/api";
import {
  statementStatusTone,
  statementStatusWords,
} from "@/features/cards/statement-words";
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  shiftDate,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useAppLink } from "@/ui/use-app-link";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];
type Statement = components["schemas"]["StatementSummary"];

// Days since the Monday of the week holding the ISO date: 0 on a Monday, 6 on a Sunday.
function daysSinceMonday(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

// One credit card: the account card with the statement purchases go on, the limit and the
// week's purchases, and below it the strip of the statement's status, dates and a closed
// statement still owing.
export function CardTile({
  account,
  institution,
  current,
  unpaid,
  loading,
  scale,
}: {
  account: Account;
  institution: Institution | undefined;
  current: Statement | undefined;
  unpaid: Statement[];
  loading: boolean;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
  const follow = useAppLink();
  const today = useToday();
  const elapsed = daysSinceMonday(today);
  const monday = shiftDate(today, -elapsed);
  const flows = useQuery(flowsQuery(api, account.id, monday, today));
  const index = useQuery(logoIndexQuery);
  const money = (m: components["schemas"]["Money"]) =>
    formatMoney(m, scale(m.currency), locale);
  const oldest = unpaid[0];
  const owed = unpaid.reduce((sum, s) => sum + s.unpaid.amount, 0);
  const limit = account.card?.credit_limit;
  const available = account.card?.available_limit;
  const signal =
    flows.data === undefined
      ? undefined
      : Array.from({ length: elapsed + 1 }, (_, i) => {
          const day = shiftDate(monday, i);
          return flows.data.find((f) => f.date === day)?.outflow.amount ?? 0;
        });
  return (
    <AccountCard
      kind="credit"
      color={accountCardColor(account.color)}
      title={account.name}
      href={`/cards/${account.id}`}
      onClick={follow({
        to: "/cards/$accountId",
        params: { accountId: account.id },
      })}
      institutionName={institution?.name}
      logo={
        index.data === undefined
          ? undefined
          : logoURL(index.data, institution?.ispb)
      }
      currency={account.currency}
      scale={scale(account.currency)}
      value={current?.amount_due.amount}
      context={
        current === undefined
          ? undefined
          : t("accountCard.due", {
              date: formatDayMonth(current.due_date, locale),
            })
      }
      meter={
        limit === undefined || available === undefined
          ? undefined
          : {
              used: Math.max(limit.amount - available.amount, 0),
              total: limit.amount,
            }
      }
      signal={signal}
      loading={loading}
    >
      <Stack gap={3}>
        {!loading && current === undefined && (
          <Text size="sm" tone="muted">
            {t("cards.noStatement")}
          </Text>
        )}
        {current !== undefined && (
          <Inline gap={2}>
            <Tag size="sm" tone={statementStatusTone[current.status]}>
              {t(statementStatusWords[current.status])}
            </Tag>
            <Text className="text-trim" size="sm" tone="muted">
              {t("cards.closesDue", {
                closing: formatDate(current.closing_date, locale),
                due: formatDate(current.due_date, locale),
              })}
            </Text>
          </Inline>
        )}
        {oldest !== undefined && (
          <Inline justify="between" gap={3}>
            <Text size="sm" weight="medium">
              {t(unpaid.length === 1 ? "cards.unpaid" : "cards.unpaidMany", {
                date: formatDate(oldest.due_date, locale),
                amount: money({
                  amount: owed,
                  currency: oldest.unpaid.currency,
                }),
                count: unpaid.length,
              })}
            </Text>
            <Button
              size="sm"
              onClick={() => {
                void navigate({
                  to: "/cards/$accountId/statements/$statementId",
                  params: {
                    accountId: account.id,
                    statementId: oldest.id,
                  },
                  search: { pay: true },
                });
              }}
            >
              {t("cards.pay")}
            </Button>
          </Inline>
        )}
      </Stack>
    </AccountCard>
  );
}
