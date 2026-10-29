import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { statementQuery, statementsQuery } from "@/features/cards/api";
import { currentAndUnpaid } from "@/features/cards/card-totals";
import { ChargeActionDialogs } from "@/features/cards/charge-action-dialogs";
import { ChargeActions } from "@/features/cards/charge-actions";
import type { ChargeAction } from "@/features/cards/charge-actions";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { StatementDialogs } from "@/features/cards/statement-dialogs";
import { StatementFigures } from "@/features/cards/statement-figures";
import { StatementHeader } from "@/features/cards/statement-header";
import type { StatementDialog } from "@/features/cards/statement-header";
import { neighbours } from "@/features/cards/statement-groups";
import { StatementAnalysis } from "@/features/cards/statement-analysis";
import { StatementLines } from "@/features/cards/statement-lines";
import { unconfirmedQuery } from "@/features/accounts";
import { useScale } from "@/features/setup";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

// One statement: its terms, its lines by day, and the commands its state allows.
export function StatementPage() {
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const scale = useScale();
  const { accountId, statementId } = useParams({
    from: "/_authed/cards/$accountId/statements/$statementId",
  });
  const search = useSearch({
    from: "/_authed/cards/$accountId/statements/$statementId",
  });
  const statement = useQuery(statementQuery(api, accountId, statementId));
  const all = useQuery(
    statementsQuery(api, accountId, addMonths(currentMonth(today), -24)),
  );
  // A secondary mark: a failed read leaves the lines unmarked.
  const unconfirmed = useQuery(unconfirmedQuery(api, accountId));
  const [dialog, setDialog] = useState<StatementDialog | null>(
    search.pay === true ? "pay" : null,
  );
  const [action, setAction] = useState<ChargeAction | null>(null);
  const s = statement.data;
  const sc = scale ?? (() => 2);
  const openReference = currentAndUnpaid(all.data ?? []).current?.reference;
  const endAction = () => {
    setAction(null);
  };
  const around = neighbours(all.data ?? [], statementId);
  const close = () => {
    setDialog(null);
    if (search.pay === true) {
      void navigate({
        to: "/cards/$accountId/statements/$statementId",
        params: { accountId, statementId },
        search: {},
        replace: true,
      });
    }
  };
  return (
    <Page width="full">
      <StatementHeader
        accountId={accountId}
        statementId={statementId}
        statement={s}
        around={around}
        onDialog={setDialog}
      />
      <PageBody>
        {statement.isError ? (
          <QueryError
            error={statement.error}
            onRetry={() => void statement.refetch()}
          />
        ) : s === undefined ? null : (
          <Stack gap={6}>
            <StatementFigures statement={s} scale={sc} />
            <StatementLines
              lines={s.postings}
              scale={sc}
              unconfirmed={
                // One transaction (an installment plan) spans statements; the entry names its own.
                new Set(
                  (unconfirmed.data ?? [])
                    .filter((entry) => entry.statement_id === statementId)
                    .map((entry) => entry.transaction_id),
                )
              }
              lineActions={(line) =>
                line.card_role === "charge" ? (
                  <ChargeActions line={line} onAction={setAction} />
                ) : null
              }
            />
            {s.status !== "open" && (
              <StatementAnalysis
                accountId={accountId}
                statementId={statementId}
                scale={sc(s.amount_due.currency)}
              />
            )}
          </Stack>
        )}
      </PageBody>
      <StatementDialogs
        statement={s}
        dialog={dialog}
        scale={sc}
        onClose={close}
        onDialog={setDialog}
      />
      <ChargeActionDialogs
        action={action}
        scale={sc}
        openReference={openReference}
        onEnd={endAction}
      />
    </Page>
  );
}
