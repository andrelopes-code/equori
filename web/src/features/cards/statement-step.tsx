import { IconButton, IconButtonLink } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { Link as RouterLink } from "@tanstack/react-router";

import { StepGlyph } from "@/ui/step-glyph";

interface StatementStepProps {
  accountId: string;
  statementId: string | undefined;
  label: string;
  direction: "previous" | "next";
}

// One step to a neighbouring statement; a missing neighbour is a disabled button in its place.
export function StatementStep({
  accountId,
  statementId,
  label,
  direction,
}: StatementStepProps) {
  const glyph = (
    <Icon>
      <StepGlyph direction={direction} />
    </Icon>
  );

  if (statementId === undefined) {
    return (
      <IconButton aria-label={label} disabled>
        {glyph}
      </IconButton>
    );
  }

  return (
    <IconButtonLink
      aria-label={label}
      render={(props) => (
        <RouterLink
          {...props}
          to="/cards/$accountId/statements/$statementId"
          params={{ accountId, statementId }}
        />
      )}
    >
      {glyph}
    </IconButtonLink>
  );
}
