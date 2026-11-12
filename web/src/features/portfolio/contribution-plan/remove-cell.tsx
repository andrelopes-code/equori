import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { TableCell } from "@slotted/react/table";

interface RemoveCellProps {
  label: string;
  onRemove: () => void;
}

// The actions column of an edit row, pinned to the end edge.
export function RemoveCell({ label, onRemove }: RemoveCellProps) {
  return (
    <TableCell sticky="end" align="end">
      <IconButton
        size="sm"
        variant="ghost"
        aria-label={label}
        onClick={onRemove}
      >
        <Icon>
          <Glyph name="trash" />
        </Icon>
      </IconButton>
    </TableCell>
  );
}
