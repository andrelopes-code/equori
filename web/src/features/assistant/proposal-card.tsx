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

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/assistant-panel.module.css";
import {
  useConfirmProposal,
  useRejectProposal,
} from "@/features/assistant/api";
import type { Decision } from "@/features/assistant/confirm-all";
import { ProposalActions } from "@/features/assistant/proposal-actions";
import {
  actionTitle,
  proposalCardState,
} from "@/features/assistant/proposal-card-state";
import { ProposalChanges } from "@/features/assistant/proposal-changes";
import { ProposalSuggestion } from "@/features/assistant/proposal-suggestion";
import { ProposalWaiting } from "@/features/assistant/proposal-waiting";
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
  waiting: "accent",
  blocked: "secondary",
} as const;

interface ProposalCardProps {
  proposal: Proposal;
  // The proposals of the answer, for a card that waits for others.
  siblings?: readonly Proposal[];
  // The last card of a new answer brings its actions into view (P13).
  reveal?: boolean;
  // The outcome of this proposal in a "confirm all" of its answer (P17).
  decision?: Decision | undefined;
  // A "confirm all" of the answer is running; the card takes no decision of its own.
  locked?: boolean;
  // Reports the card's own decision, so a "confirm all" leaves it out.
  onDecided?: (id: string, decision: Decision) => void;
}

// Families read: card, badge, typography, button, link. A write the assistant proposes: what
// it does and to what, each value it changes, and the two decisions while it waits. A decided card
// keeps its changes and says its outcome in the header.
export function ProposalCard({
  proposal,
  siblings = [],
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
  const { status, hint, failure, outcome, screen } = proposalCardState({
    shown,
    passed,
    busy,
    error,
    t,
  });
  const pending = status === "pending";
  const destructive = preview.destructive === true;
  const opens = screen !== undefined && served({ href: screen });

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
    <Card size="md" fill={pending ? "elevated" : "outline"}>
      <CardHeader>
        <span className={styles.proposalTitle}>
          <Text size="sm" weight="semibold">
            {actionTitle(preview.action, t)}
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
        {status === "waiting" ? (
          <ProposalWaiting proposal={shown} siblings={siblings} />
        ) : (
          <ProposalChanges changes={preview.changes} />
        )}
        {shown.suggested && <ProposalSuggestion reason={shown.reason} />}
      </CardBody>

      {pending && (
        <CardFooter>
          <ProposalActions
            ref={actions}
            expiresAt={shown.expires_at}
            destructive={destructive}
            error={failure}
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

      {status === "blocked" && (
        <CardFooter>
          <Text size="sm" tone="muted">
            {t("assistant.proposal.blocked")}
          </Text>
        </CardFooter>
      )}

      {!pending && outcome !== undefined && (
        <CardFooter>
          <Text
            size="sm"
            tone={hint ? "muted" : "danger"}
            role={failure === undefined ? undefined : "status"}
          >
            {outcome}
          </Text>
        </CardFooter>
      )}
    </Card>
  );
}
