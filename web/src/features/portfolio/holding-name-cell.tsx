import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts";
import { InstrumentName } from "@/features/portfolio/instrument-name";
import type { Holding } from "@/features/portfolio/portfolio-holdings";

type Account = components["schemas"]["Account"];

interface HoldingNameCellProps {
  holding: Holding;
  account: Account | undefined;
}

// A position opens its instrument; cash opens its account.
export function HoldingNameCell({ holding, account }: HoldingNameCellProps) {
  if (holding.kind === "cash")
    return account === undefined ? (
      <Text size="sm">{holding.name}</Text>
    ) : (
      <AccountLink account={account}>{holding.name}</AccountLink>
    );

  return <InstrumentName code={holding.code} name={holding.name} />;
}
