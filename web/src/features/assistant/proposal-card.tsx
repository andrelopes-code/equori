import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Badge } from "@slotted/react/badge";
import { Button } from "@slotted/react/button";
import { Card, CardBody, CardFooter, CardHeader } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/assistant-panel.module.css";
import {
  useConfirmProposal,
  useRejectProposal,
} from "@/features/assistant/api";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { ProposalChange } from "@/features/assistant/proposal-change";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useEffect, useRef } from "react";

import type { Decision } from "@/features/assistant/confirm-all";
import { proposalScreen } from "@/features/assistant/proposal-screen";
import { useExpired } from "@/features/assistant/use-expired";
import { useAppLink } from "@/ui/use-app-link";
import { Link } from "@slotted/react/link";

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

// Families read: card, badge, description-list, alert, button. A write the assistant proposes:
// what it does and to what, each value it changes, and the two decisions while it waits.
export function ProposalCard({
  proposal,
  reveal = false,
  decision,
}: {
  proposal: Proposal;
  // The last card of a new answer brings its actions into view (P13).
  reveal?: boolean;
  // The outcome of this proposal in a "confirm all" of its answer (P17).
  decision?: Decision | undefined;
}) {
  const t = useT();
  const follow = useAppLink();
  const [locale] = useAppLocale();
  const valueText = useValueText();
  const confirm = useConfirmProposal();
  const reject = useRejectProposal();
  const shown = confirm.data ?? reject.data ?? decision?.proposal ?? proposal;
  const { preview } = shown;
  const busy = confirm.isPending || reject.isPending;
  const error = confirm.error ?? reject.error ?? decision?.error ?? null;
  const screen =
    shown.status === "executed"
      ? proposalScreen(shown.tool, shown.result)
      : undefined;
  const actionKey = catalogKey(`assistant.action.${preview.action}`);
  const detail =
    shown.status === "failed" ? failureDetail(shown.result) : undefined;
  // The server's answer to a confirm in flight wins over the timer (P15).
  const passed = useExpired(shown.expires_at, shown.status === "pending");
  const status =
    shown.status === "pending" && passed && !busy ? "expired" : shown.status;
  const pending = status === "pending";
  const destructive = preview.destructive === true;
  const actions = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reveal) actions.current?.scrollIntoView({ block: "nearest" });
  }, [reveal]);

  return (
    <Card size="sm" fill={pending ? "elevated" : "outline"}>
      <CardHeader>
        <Stack gap={1}>
          <span className={styles.proposalHead}>
            <Text weight="semibold">
              {actionKey === undefined ? preview.action : t(actionKey)}
            </Text>
            <Badge tone={tones[status]} size="sm">
              {t(`assistant.proposal.status.${status}`)}
            </Badge>
          </span>
          {preview.target !== undefined && (
            <Text size="sm" tone="muted">
              {valueText({ text: preview.target })}
            </Text>
          )}
          {pending && (
            <Text size="xs" tone="muted">
              {t("assistant.proposal.expires", {
                time: new Intl.DateTimeFormat(locale, {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(shown.expires_at)),
              })}
            </Text>
          )}
        </Stack>
      </CardHeader>
      <CardBody>
        <Stack gap={3}>
          <DescriptionList layout="stack" columns={2}>
            {preview.changes.map((change, i) => {
              const fieldKey = catalogKey(`assistant.field.${change.field}`);
              return (
                <DescriptionListItem key={`${change.field}-${String(i)}`}>
                  <DescriptionListTerm>
                    {fieldKey === undefined ? change.field : t(fieldKey)}
                  </DescriptionListTerm>
                  <DescriptionListDescription>
                    <ProposalChange
                      before={valueText(change.before)}
                      after={valueText(change.after)}
                    />
                  </DescriptionListDescription>
                </DescriptionListItem>
              );
            })}
          </DescriptionList>
          {destructive && pending && (
            <Alert tone="danger" reach="inline">
              <AlertContent>
                <AlertDescription>
                  {t("assistant.proposal.destructive")}
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {detail !== undefined && (
            <Alert tone="danger" reach="inline">
              <AlertContent>
                <AlertDescription>{detail}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {screen !== undefined && (
            <Text size="sm">
              <Link href={screen} onClick={follow({ href: screen })}>
                {t("assistant.proposal.open")}
              </Link>
            </Text>
          )}
          {error !== null && (
            <Alert tone="danger" reach="inline" live="polite">
              <AlertContent>
                <AlertDescription>{errorText(error, t)}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </Stack>
      </CardBody>
      {pending && (
        <CardFooter>
          <span className={styles.proposalActions} ref={actions}>
            <Button
              variant="ghost"
              tone="secondary"
              disabled={busy}
              loading={reject.isPending}
              onClick={() => {
                reject.mutate(shown.id);
              }}
            >
              {t("assistant.proposal.reject")}
            </Button>
            <Button
              tone={destructive ? "danger" : "accent"}
              disabled={busy}
              loading={confirm.isPending}
              onClick={() => {
                if (!busy) confirm.mutate(shown.id);
              }}
            >
              {t("assistant.proposal.confirm")}
            </Button>
          </span>
        </CardFooter>
      )}
    </Card>
  );
}
