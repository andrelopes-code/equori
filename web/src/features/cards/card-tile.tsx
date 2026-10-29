import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  AccountCard,
  accountCardColor,
  logoIndexQuery,
  logoOf,
} from "@/features/accounts";
import { flowsQuery } from "@/features/cards/api";
import { limitMeter } from "@/features/cards/card-totals";
import { StatementStub } from "@/features/cards/statement-stub";
import { daysSinceMonday, weekOutflows } from "@/features/cards/week-outflows";
import { formatDayMonth, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];
type Statement = components["schemas"]["StatementSummary"];

interface CardTileProps {
  account: Account;
  institution: Institution | undefined;
  current: Statement | undefined;
  unpaid: Statement[];
  loading: boolean;
  scale: (code: string) => number;
}

// One credit card: the account card with the statement purchases go on, the limit and the
// week's purchases, and below it a closed statement still owing.
export function CardTile({
  account,
  institution,
  current,
  unpaid,
  loading,
  scale,
}: CardTileProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const elapsed = daysSinceMonday(today);
  const monday = shiftDate(today, -elapsed);
  const flows = useQuery(flowsQuery(api, account.id, monday, today));
  const index = useQuery(logoIndexQuery);

  const signal =
    flows.data === undefined
      ? undefined
      : weekOutflows(monday, elapsed, flows.data);
  const context =
    current === undefined
      ? undefined
      : t("accountCard.due", {
          date: formatDayMonth(current.due_date, locale),
        });

  return (
    <AccountCard
      kind="credit"
      color={accountCardColor(account.color)}
      title={account.name}
      link={{
        to: "/cards/$accountId",
        params: { accountId: account.id },
      }}
      institutionName={institution?.name}
      logo={logoOf(institution?.identifier, index.data)}
      currency={account.currency}
      scale={scale(account.currency)}
      value={current?.open_amount.amount}
      context={context}
      meter={limitMeter(account.card)}
      signal={signal}
      loading={loading}
    >
      <StatementStub
        accountId={account.id}
        unpaid={unpaid}
        scale={scale(unpaid[0]?.unpaid.currency ?? account.currency)}
      />

      {!loading && current === undefined && (
        <Text size="sm" tone="muted">
          {t("cards.noStatement")}
        </Text>
      )}
    </AccountCard>
  );
}
