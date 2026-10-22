import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { transactionSummaryQuery } from "@/features/accounts/api";
import { CandidateScoreTable } from "@/features/accounts/candidate-score-table";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type ScoredCandidate = components["schemas"]["ScoredCandidate"];

// One transaction the line may confirm: what it is, its score taken apart, and the command.
export function CandidateCard({
  candidate,
  accountId,
  scale,
  busy,
  onMatch,
}: {
  candidate: ScoredCandidate;
  accountId: string;
  scale: (code: string) => number;
  busy: boolean;
  onMatch: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const tx = useQuery(
    transactionSummaryQuery(useApi(), candidate.transaction_id),
  );
  const own = tx.data?.postings.filter((p) => p.account_id === accountId) ?? [];
  const amount = own.reduce((sum, p) => sum + p.amount.amount, 0);
  const currency = own[0]?.amount.currency;
  const name =
    tx.data === undefined
      ? t("batch.candidateLoading")
      : tx.data.description === ""
        ? t("ledger.untitled")
        : tx.data.description;
  return (
    <Card>
      <CardBody>
        <Stack gap={3}>
          <Inline justify="between" gap={3}>
            <Stack gap={0}>
              <Text size="sm" weight="semibold">
                {name}
              </Text>
              {tx.data !== undefined && (
                <Text size="xs" tone="muted">
                  {formatDate(tx.data.date, locale)}
                </Text>
              )}
            </Stack>
            {tx.data !== undefined && currency !== undefined && (
              <Text size="sm" weight="semibold">
                {fmt.signed({ amount, currency }, scale(currency))}
              </Text>
            )}
          </Inline>
          <CandidateScoreTable candidate={candidate} name={name} />
          <div>
            <Button size="sm" loading={busy} onClick={onMatch}>
              {t("batch.match")}
            </Button>
          </div>
        </Stack>
      </CardBody>
    </Card>
  );
}
