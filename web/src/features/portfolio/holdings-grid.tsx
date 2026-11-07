import type {
  GridColumn,
  GridColumnState,
  GridQuery,
} from "@slotted/core/grid";
import { emptyQuery } from "@slotted/core/grid";
import { DataGrid } from "@slotted/react/data-grid";
import { Text } from "@slotted/react/typography";
import { useCallback, useMemo, useState } from "react";

import type { components } from "@/api/schema.gen";
import { HoldingGainCell } from "@/features/portfolio/holding-gain-cell";
import { HoldingNameCell } from "@/features/portfolio/holding-name-cell";
import { HoldingValueCell } from "@/features/portfolio/holding-value-cell";
import type { GridHolding } from "@/features/portfolio/holdings-columns";

type Account = components["schemas"]["Account"];

interface HoldingsGridProps {
  label: string;
  columns: GridColumn<GridHolding>[];
  rows: readonly GridHolding[];
  columnState: GridColumnState;
  date: string;
  valueIn: string;
  accounts: ReadonlyMap<string, Account>;
  loading: boolean;
  onColumnState: (state: GridColumnState) => void;
}

const initialQuery: GridQuery = { ...emptyQuery(), group: ["group"] };

// The list of PC7. It keeps the order it is given until the reader sorts a column, so the largest
// group opens the list; the group column stays out of sight.
export function HoldingsGrid({
  label,
  columns,
  rows,
  columnState,
  date,
  valueIn,
  accounts,
  loading,
  onColumnState,
}: HoldingsGridProps) {
  const [query, setQuery] = useState<GridQuery>(initialQuery);

  const shown = useMemo(
    () => ({ ...columnState, hidden: [...columnState.hidden, "group"] }),
    [columnState],
  );
  const cellRenderers = useMemo(
    () => ({
      name: ({ row }: { row: GridHolding }) => (
        <HoldingNameCell holding={row} account={accounts.get(row.accountID)} />
      ),
      value: ({ row }: { row: GridHolding }) => (
        <HoldingValueCell holding={row} valueIn={valueIn} date={date} />
      ),
      gain: ({ row }: { row: GridHolding }) => (
        <HoldingGainCell holding={row} valueIn={valueIn} />
      ),
    }),
    [accounts, date, valueIn],
  );
  const renderGroup = useCallback(
    ({ node }: { node: { text: string; count: number } }) => {
      const label = `${node.text} · ${String(node.count)}`;

      return <Text weight="semibold">{label}</Text>;
    },
    [],
  );

  return (
    <DataGrid
      aria-label={label}
      variant="framed"
      columns={columns}
      rows={rows}
      rowKey="key"
      rowHeight={44}
      columnState={shown}
      onColumnStateChange={onColumnState}
      query={query}
      onQueryChange={setQuery}
      loading={loading}
      cellRenderers={cellRenderers}
      renderGroup={renderGroup}
    />
  );
}
