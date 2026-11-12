import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { AwaitingFigure } from "@/features/cards/statement-figures/awaiting-figure";
import { DifferenceProposal } from "@/features/cards/statement-figures/difference-proposal";
import { StatementBillLine } from "@/features/cards/statement-figures/statement-bill-line";
import { StatementOpenLine } from "@/features/cards/statement-figures/statement-open-line";
import { UnconfirmedNotice } from "@/features/cards/statement-figures/unconfirmed-notice";

type Statement = components["schemas"]["StatementDetail"];

interface StatementFiguresProps {
  statement: Statement;
  scale: (code: string) => number;
}

// The statement's terms (A89): the bill as one line, what is still open, and what still waits
// for the bank.
export function StatementFigures({ statement, scale }: StatementFiguresProps) {
  return (
    <Stack gap={3}>
      <StatementBillLine statement={statement} scale={scale} />
      <StatementOpenLine statement={statement} scale={scale} />
      <AwaitingFigure statement={statement} scale={scale} />
      <DifferenceProposal statement={statement} scale={scale} />
      <UnconfirmedNotice statement={statement} />
    </Stack>
  );
}
