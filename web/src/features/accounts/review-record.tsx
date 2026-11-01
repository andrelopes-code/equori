import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useResolveRecord } from "@/features/accounts/api";
import { CandidateList } from "@/features/accounts/candidate-list";
import { GroupConfirm } from "@/features/accounts/group-confirm";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type ExternalRecord = components["schemas"]["ExternalRecord"];
type RecordResolution = components["schemas"]["RecordResolution"];

const reasonWords: Record<
  NonNullable<ExternalRecord["review_reason"]>,
  MessageKey
> = {
  ambiguous: "batch.reason.ambiguous",
  probable: "batch.reason.probable",
  changed: "batch.reason.changed",
  repeated: "batch.reason.repeated",
  group: "batch.reason.group",
};

// The line waiting for review, the transactions it may confirm best first, and the three ways
// to settle it (A100, A102).
export function ReviewRecord({
  record,
  scale,
  onResolved,
  onStale,
}: {
  record: ExternalRecord;
  scale: (code: string) => number;
  onResolved: () => void;
  onStale: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const resolve = useResolveRecord();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const run = (resolution: RecordResolution, key: string) => {
    setMessage(null);
    setPending(key);
    resolve
      .mutateAsync({ id: record.id, resolution })
      .then(onResolved)
      .catch((caught: unknown) => {
        if (
          caught instanceof ProblemError &&
          (caught.problem.code === "record_resolved" ||
            caught.problem.code === "already_matched")
        ) {
          // ER-02: the queue is read again before the message says so.
          onStale();
          setMessage(
            caught.problem.code === "record_resolved"
              ? t("batch.resolvedElsewhere")
              : t("problem.already_matched"),
          );
          return;
        }
        setMessage(errorText(caught, t));
      })
      .finally(() => {
        setPending(null);
      });
  };
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Heading level={2} size="md">
          {record.description === ""
            ? t("ledger.untitled")
            : record.description}
        </Heading>
        <Inline gap={4}>
          <Text size="sm" tone="muted">
            {formatDate(record.date, locale)}
          </Text>
          <Text size="md" weight="semibold">
            {fmt.signed(record.amount, scale(record.amount.currency))}
          </Text>
        </Inline>
        {record.review_reason !== undefined && (
          <Text size="sm">{t(reasonWords[record.review_reason])}</Text>
        )}
        {record.unapplied_change !== undefined && (
          <Text size="sm" tone="muted">
            {t("batch.unapplied", { change: record.unapplied_change })}
          </Text>
        )}
      </Stack>
      {message !== null && (
        <Alert tone="warning" live="polite">
          <AlertContent>
            <AlertDescription>{message}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <Inline gap={3}>
        <Button
          variant="outline"
          loading={pending === "create"}
          onClick={() => {
            run({ action: "create" }, "create");
          }}
        >
          {t("batch.create")}
        </Button>
        <Button
          variant="ghost"
          tone="danger"
          loading={pending === "discard"}
          onClick={() => {
            run({ action: "discard" }, "discard");
          }}
        >
          {t("batch.discard")}
        </Button>
      </Inline>
      {record.review_reason === "group" && (
        <GroupConfirm
          record={record}
          busy={pending === "group"}
          onConfirm={(transactionId) => {
            run({ action: "match", transaction_id: transactionId }, "group");
          }}
        />
      )}
      {record.review_reason !== "group" && (
        <CandidateList
          record={record}
          scale={scale}
          pending={pending}
          onMatch={(transactionId) => {
            run(
              { action: "match", transaction_id: transactionId },
              transactionId,
            );
          }}
        />
      )}
    </Stack>
  );
}
