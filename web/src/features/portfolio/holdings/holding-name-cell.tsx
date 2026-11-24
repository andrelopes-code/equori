import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts";
import styles from "@/features/portfolio/holdings/holding-name-cell.module.css";
import { HoldingIncomeLink } from "@/features/portfolio/holdings/holding-income-link";
import { InstrumentName } from "@/ui/display/instrument-name";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";

type Account = components["schemas"]["Account"];

interface HoldingNameCellProps {
  holding: Holding;
  account: Account | undefined;
}

// A position opens its instrument and records its income; cash opens its account.
export function HoldingNameCell({ holding, account }: HoldingNameCellProps) {
  if (holding.kind === "cash")
    return account === undefined ? (
      <Text size="sm">{holding.name}</Text>
    ) : (
      <AccountLink account={account}>{holding.name}</AccountLink>
    );

  return (
    <Inline gap={2} justify="between" wrap="nowrap" className={styles.cell}>
      <InstrumentName code={holding.code} name={holding.name} />
      <HoldingIncomeLink accountID={holding.accountID} name={holding.name} />
    </Inline>
  );
}
