import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { transactionSummaryQuery } from "@/features/accounts/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface TransferCandidateCardProps {
  transactionId: string;
  amount: Money;
  scale: (code: string) => number;
  busy: boolean;
  onMatch: () => void;
}

// One transaction of another account that moves the opposite amount of the line.
export function TransferCandidateCard({
  transactionId,
  amount,
  scale,
  busy,
  onMatch,
}: TransferCandidateCardProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const tx = useQuery(transactionSummaryQuery(useApi(), transactionId));

  const opposite = tx.data?.postings.find(
    (p) =>
      p.amount.amount === -amount.amount &&
      p.amount.currency === amount.currency,
  );
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
            {opposite !== undefined && (
              <Text numeric="tabular" size="sm" weight="semibold">
                {fmt.signed(opposite.amount, scale(opposite.amount.currency))}
              </Text>
            )}
          </Inline>
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
