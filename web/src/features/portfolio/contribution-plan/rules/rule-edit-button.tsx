import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipLayer,
  TooltipTrigger,
} from "@slotted/react/tooltip";

interface RuleEditButtonProps {
  // The tooltip, which is also the accessible name.
  label: string;
  onEdit: () => void;
}

export function RuleEditButton({ label, onEdit }: RuleEditButtonProps) {
  return (
    <Tooltip describes="label">
      <TooltipTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={onEdit}
          >
            <Icon>
              <Glyph name="pencil" />
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
