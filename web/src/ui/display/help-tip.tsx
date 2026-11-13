import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipLayer,
  TooltipTrigger,
} from "@slotted/react/tooltip";

import styles from "@/ui/display/help-tip.module.css";

interface HelpTipProps {
  // The accessible name of the button, which names the term it explains.
  label: string;
  text: string;
}

// The question mark beside a term whose meaning a reader may not know: hover or focus opens the
// explanation. The explanation is never the only place a fact is written (Slotted tooltip rule).
export function HelpTip({ label, text }: HelpTipProps) {
  return (
    <Tooltip size="sm">
      <TooltipTrigger
        render={(props) => (
          <IconButton
            {...props}
            aria-label={label}
            size="sm"
            variant="ghost"
            tone="secondary"
            className={styles.trigger}
          >
            <Icon size="sm">
              <Glyph name="circle-question" />
            </Icon>
          </IconButton>
        )}
      />
      <TooltipLayer>
        <TooltipContent className={styles.content}>{text}</TooltipContent>
        <TooltipArrow />
      </TooltipLayer>
    </Tooltip>
  );
}
