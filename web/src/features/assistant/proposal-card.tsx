import { Badge } from "@slotted/react/badge";
import { Button } from "@slotted/react/button";
import { Card, CardBody, CardFooter, CardHeader } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { InlineMessage } from "@slotted/react/inline-message";
import { Text } from "@slotted/react/typography";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  useConfirmProposal,
  useRejectProposal,
} from "@/features/assistant/api";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Proposal = components["schemas"]["AssistantProposal"];
type Value = components["schemas"]["AssistantValue"];

const tones = {
  pending: "accent",
  executing: "info",
  executed: "success",
  failed: "danger",
  rejected: "secondary",
  stale: "warning",
  expired: "warning",
  discarded: "secondary",
} as const;

export function catalogKey(key: string): MessageKey | undefined {
  return key in catalogEn ? (key as MessageKey) : undefined;
}

// The decimal string of the API ("1234.56") becomes an integer and its scale by string
// manipulation (O7).
function minorUnits(amount: string): { minor: number; scale: number } {
  const [, fraction = ""] = amount.split(".");
  return { minor: Number(amount.replace(".", "")), scale: fraction.length };
}

function useValueText() {
  const [locale] = useAppLocale();
  const money = useMoneyFormat();
  return (value: Value | undefined): string | undefined => {
    if (value === undefined) return undefined;
    if (value.amount !== undefined && value.currency !== undefined) {
      const { minor, scale } = minorUnits(value.amount);
      return money.money({ amount: minor, currency: value.currency }, scale);
    }
    if (value.date !== undefined) return formatDate(value.date, locale);
    const text = value.text ?? "";
    return money.hidden ? maskAmountText(text) : text;
  };
}

function failureDetail(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) return undefined;
  const detail = (result as { detail?: unknown }).detail;
  return typeof detail === "string" ? detail : undefined;
}

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const t = useT();
  const valueText = useValueText();
  const confirm = useConfirmProposal();
  const reject = useRejectProposal();
  const shown = confirm.data ?? reject.data ?? proposal;
  const { preview } = shown;
  const busy = confirm.isPending || reject.isPending;
  const error = confirm.error ?? reject.error;
  const actionKey = catalogKey(`assistant.action.${preview.action}`);
  const detail =
    shown.status === "failed" ? failureDetail(shown.result) : undefined;

  return (
    <Card>
      <CardHeader>
        <Text weight="semibold">
          {actionKey === undefined ? preview.action : t(actionKey)}
        </Text>
        <Badge tone={tones[shown.status]}>
          {t(`assistant.proposal.status.${shown.status}`)}
        </Badge>
      </CardHeader>
      <CardBody>
        {preview.target !== undefined && (
          <Text tone="muted">{preview.target}</Text>
        )}
        <DescriptionList layout="stack">
          {preview.changes.map((change) => {
            const before = valueText(change.before);
            const after = valueText(change.after);
            const fieldKey = catalogKey(`assistant.field.${change.field}`);
            return (
              <DescriptionListItem key={change.field}>
                <DescriptionListTerm>
                  {fieldKey === undefined ? change.field : t(fieldKey)}
                </DescriptionListTerm>
                <DescriptionListDescription>
                  {before !== undefined && after !== undefined
                    ? `${before} → ${after}`
                    : (after ?? before)}
                </DescriptionListDescription>
              </DescriptionListItem>
            );
          })}
        </DescriptionList>
        {preview.destructive === true && shown.status === "pending" && (
          <InlineMessage tone="warning">
            {t("assistant.proposal.destructive")}
          </InlineMessage>
        )}
        {detail !== undefined && (
          <InlineMessage tone="danger">{detail}</InlineMessage>
        )}
        {error !== null && (
          <InlineMessage tone="danger" live="polite">
            {errorText(error, t)}
          </InlineMessage>
        )}
      </CardBody>
      {shown.status === "pending" && (
        <CardFooter>
          <Button
            variant="ghost"
            tone="secondary"
            disabled={busy}
            onClick={() => {
              reject.mutate(shown.id);
            }}
          >
            {t("assistant.proposal.reject")}
          </Button>
          <Button
            tone={preview.destructive === true ? "danger" : "accent"}
            disabled={busy}
            loading={confirm.isPending}
            onClick={() => {
              if (!busy) confirm.mutate(shown.id);
            }}
          >
            {t("assistant.proposal.confirm")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
