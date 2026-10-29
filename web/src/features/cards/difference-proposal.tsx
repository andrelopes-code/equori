import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import type { components } from "@/api/schema.gen";
import { useDeferStatementPostings } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type StatementDetail = components["schemas"]["StatementDetail"];

export interface DifferenceProposalProps {
  statement: StatementDetail;
  scale: (code: string) => number;
}

// A137: the postings whose move to the next statement closes the difference with the
// institution's total, or the note that the difference is the source's rounding.
export function DifferenceProposal({
  statement,
  scale,
}: DifferenceProposalProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const defer = useDeferStatementPostings();

  const proposal = statement.difference_proposal;
  const difference = statement.amount_difference;
  if (
    difference === undefined ||
    (proposal === undefined && statement.rounding_difference !== true)
  ) {
    return null;
  }

  const amount = fmt.money(difference, scale(difference.currency));
  const names = statement.postings
    .filter((p) => proposal?.transaction_ids.includes(p.transaction_id))
    .map((p) => p.description)
    .join(", ");

  function handleMove() {
    if (proposal === undefined) return;
    defer.mutate({
      id: statement.id,
      transactionIds: proposal.transaction_ids,
    });
  }

  return (
    <>
      {proposal !== undefined && (
        <Alert tone="warning">
          <AlertContent>
            <AlertTitle>{t("statement.proposal.title", { amount })}</AlertTitle>
            <AlertDescription>
              {t("statement.proposal.description", { names })}
            </AlertDescription>
          </AlertContent>

          <AlertActions>
            <Button onClick={handleMove} loading={defer.isPending}>
              {t("statement.proposal.move")}
            </Button>
          </AlertActions>
        </Alert>
      )}
      {statement.rounding_difference === true && (
        <Alert tone="info">
          <AlertContent>
            <AlertDescription>
              {t("statement.rounding", { amount })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </>
  );
}
