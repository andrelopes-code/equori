import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipLayer,
  TooltipTrigger,
} from "@slotted/react/tooltip";

interface RemoveButtonProps {
  // The tooltip, which is also the accessible name.
  label: string;
  onRemove: () => void;
}

// The remove action of a group or an asset: an icon button named by its tooltip.
export function RemoveButton({ label, onRemove }: RemoveButtonProps) {
  return (
    <Tooltip describes="label">
      <TooltipTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={onRemove}
          >
            <Icon>
              <Glyph name="trash" />
            </Icon>
          </IconButton>
        )}
      />
      <TooltipLayer>
        <TooltipContent>{label}</TooltipContent>
      </TooltipLayer>
    </Tooltip>
  );
}
