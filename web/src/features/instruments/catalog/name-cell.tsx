import { Tag } from "@slotted/react/tag";

import styles from "@/features/instruments/catalog/name-cell.module.css";
import { RowText } from "@/features/instruments/catalog/row-text";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { useT } from "@/i18n/i18n-provider";

interface NameCellProps {
  row: CatalogRow;
}

// The name, after the tag of a hidden row (A238 HD12). Both are children of the cell: the
// name gives way and the tag keeps its width.
export function NameCell({ row }: NameCellProps) {
  const t = useT();

  return (
    <>
      {row.hidden && (
        <Tag size="sm" className={styles.tag}>
          {t("instrument.hidden")}
        </Tag>
      )}

      <RowText row={row} title={row.name}>
        {row.name}
      </RowText>
    </>
  );
}
