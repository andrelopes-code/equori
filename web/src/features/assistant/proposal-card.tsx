import { Badge } from "@slotted/react/badge";
import {
  Card,
  CardActions,
  CardBody,
  CardFooter,
  CardHeader,
} from "@slotted/react/card";
import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";
import { useEffect, useRef } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/assistant-panel.module.css";
import {
  useConfirmProposal,
  useRejectProposal,
} from "@/features/assistant/api";
import { AssistantNote } from "@/features/assistant/assistant-note";
import { catalogKey } from "@/features/assistant/catalog-key";
import type { Decision } from "@/features/assistant/confirm-all";
import { ProposalActions } from "@/features/assistant/proposal-actions";
import { ProposalChanges } from "@/features/assistant/proposal-changes";
import { proposalScreen } from "@/features/assistant/proposal-screen";
import { useExpired } from "@/features/assistant/use-expired";
import { useValueText } from "@/features/assistant/use-value-text";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";
import { useServed } from "@/ui/use-served";

type Proposal = components["schemas"]["AssistantProposal"];

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

interface ProposalCardProps {
  proposal: Proposal;
  // The last card of a new answer brings its actions into view (P13).
  reveal?: boolean;
  // The outcome of this proposal in a "confirm all" of its answer (P17).
  decision?: Decision | undefined;
  // A "confirm all" of the answer is running; the card takes no decision of its own.
  locked?: boolean;
  // Reports the card's own decision, so a "confirm all" leaves it out.
  onDecided?: (id: string, decision: Decision) => void;
}

// Families read: card, badge, description-list, button, link. A write the assistant proposes: what
// it does and to what, each value it changes, and the two decisions while it waits. A decided card
// keeps its changes and says its outcome in the header.
export function ProposalCard({
  proposal,
  reveal = false,
  decision,
  locked = false,
  onDecided,
}: ProposalCardProps) {
  const t = useT();
  const served = useServed();
  const valueText = useValueText();
  const confirm = useConfirmProposal();
  const reject = useRejectProposal();
  const actions = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reveal) actions.current?.scrollIntoView({ block: "nearest" });
  }, [reveal]);

  const shown = confirm.data ?? reject.data ?? decision?.proposal ?? proposal;
  const { preview } = shown;
  const busy = confirm.isPending || reject.isPending || locked;
  const error = confirm.error ?? reject.error ?? decision?.error ?? null;
  // The server's answer to a confirm in flight wins over the timer (P15).
  const passed = useExpired(shown.expires_at, shown.status === "pending");
  const status =
    shown.status === "pending" && passed && !busy ? "expired" : shown.status;
  const pending = status === "pending";
  const destructive = preview.destructive === true;
  const actionKey = catalogKey(`assistant.action.${preview.action}`);
  const detail =
    shown.status === "failed" ? failureDetail(shown.result) : undefined;
  const screen =
    shown.status === "executed"
      ? proposalScreen(shown.tool, shown.result)
      : undefined;
  const opens = screen !== undefined && served({ href: screen });
  const hint = status === "stale" || status === "expired";

  function handleConfirm() {
    if (busy) return;

    confirm.mutate(shown.id, {
      onSuccess: (result) => onDecided?.(shown.id, { proposal: result }),
    });
  }

  function handleReject() {
    reject.mutate(shown.id, {
      onSuccess: (result) => onDecided?.(shown.id, { proposal: result }),
    });
  }

  return (
    <Card size="sm" fill={pending ? "elevated" : "outline"}>
      <CardHeader>
        <span className={styles.proposalTitle}>
          {/* Workaround for Slotted issue #55: inside a message the card's header takes the
              message's muted colour, so the title states its own. */}
          <Text size="sm" weight="semibold" tone="default">
            {actionKey === undefined ? preview.action : t(actionKey)}
          </Text>
          {preview.target !== undefined && (
            <Text size="sm" tone="muted">
              {valueText({ text: preview.target })}
            </Text>
          )}
        </span>
        {!pending && (
          <CardActions>
            <Badge tone={tones[status]} size="sm">
              {t(`assistant.proposal.status.${status}`)}
            </Badge>
          </CardActions>
        )}
      </CardHeader>

      <CardBody>
        <span className={styles.proposalBody}>
          <ProposalChanges changes={preview.changes} />
          {destructive && pending && (
            <AssistantNote tone="danger">
              {t("assistant.proposal.destructive")}
            </AssistantNote>
          )}
          {detail !== undefined && (
            <AssistantNote tone="danger">{detail}</AssistantNote>
          )}
          {error !== null && (
            <AssistantNote tone="danger" live>
              {errorText(error, t)}
            </AssistantNote>
          )}
        </span>
      </CardBody>

      {pending && (
        <CardFooter>
          <ProposalActions
            ref={actions}
            expiresAt={shown.expires_at}
            destructive={destructive}
            busy={busy}
            confirming={confirm.isPending}
            rejecting={reject.isPending}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        </CardFooter>
      )}

      {opens && (
        <CardFooter>
          <Text size="sm">
            <Link render={routeTo({ href: screen })}>
              {t("assistant.proposal.open")}
            </Link>
          </Text>
        </CardFooter>
      )}

      {hint && (
        <CardFooter>
          <Text size="xs" tone="muted">
            {t(`assistant.proposal.hint.${status}`)}
          </Text>
        </CardFooter>
      )}
    </Card>
  );
}

function failureDetail(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) return undefined;

  const detail = (result as { detail?: unknown }).detail;

  return typeof detail === "string" ? detail : undefined;
}
