import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts";
import type { Holding } from "@/features/portfolio/portfolio-holdings";
import { AppLink } from "@/ui/app-link";

type Account = components["schemas"]["Account"];

interface HoldingNameCellProps {
  holding: Holding;
  account: Account | undefined;
}

// A position reads by its name with its code beside it and opens its instrument; cash opens its
// account. The code repeats nothing when the catalog names the instrument by its code.
export function HoldingNameCell({ holding, account }: HoldingNameCellProps) {
  if (holding.kind === "cash")
    return account === undefined ? (
      <Text size="sm">{holding.name}</Text>
    ) : (
      <AccountLink account={account}>{holding.name}</AccountLink>
    );

  return (
    <Inline gap={2} align="center" wrap="nowrap">
      <AppLink
        variant="neutral"
        underline="hover"
        to={{ to: "/instruments/$code", params: { code: holding.code } }}
      >
        {holding.name}
      </AppLink>
      {holding.name !== holding.code && (
        <Text size="sm" tone="muted">
          {holding.code}
        </Text>
      )}
    </Inline>
  );
}
