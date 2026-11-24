import type { GridColumn, GridColumnState } from "@slotted/core/grid";
import { Button } from "@slotted/react/button";
import {
  ColumnManager,
  ColumnManagerRoot,
  ColumnManagerTrigger,
} from "@slotted/react/column-manager";
import { useMemo } from "react";

import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { useT } from "@/i18n/i18n-provider";

interface CatalogColumnManagerProps {
  columns: GridColumn<CatalogRow>[];
  columnState: GridColumnState;
  defaultColumnState: Partial<GridColumnState>;
  onColumnState: (state: GridColumnState) => void;
}

// IQ14: the group rows carry the type, so its column is not among the choices.
export function CatalogColumnManager({
  columns,
  columnState,
  defaultColumnState,
  onColumnState,
}: CatalogColumnManagerProps) {
  const t = useT();
  const managed = useMemo(
    () => columns.filter((column) => column.id !== "type"),
    [columns],
  );

  return (
    <ColumnManagerRoot>
      <ColumnManagerTrigger
        render={(props) => (
          <Button {...props} variant="ghost" tone="secondary">
            {t("instruments.columns")}
          </Button>
        )}
      />
      <ColumnManager
        columns={managed}
        columnState={columnState}
        defaultColumnState={defaultColumnState}
        onColumnStateChange={onColumnState}
      />
    </ColumnManagerRoot>
  );
}
