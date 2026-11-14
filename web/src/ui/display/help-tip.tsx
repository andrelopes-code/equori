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
  // The accessible name of the trigger, which names the term it explains.
  label: string;
  text: string;
}

// The question mark beside a term whose meaning a reader may not know: hover or focus opens the
// explanation. The explanation is never the only place a fact is written (Slotted tooltip rule).
// Workaround for Slotted issue #106: button and icon-button draw a ground on hover and a control's
// height, and tooltip has no trigger of its own, so the mark inside a line of text is own element.
export function HelpTip({ label, text }: HelpTipProps) {
  return (
    <Tooltip size="sm">
      <TooltipTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-label={label}
            className={styles.trigger}
          >
            <Icon size="sm">
              <Glyph name="circle-question" />
            </Icon>
          </button>
        )}
      />
      <TooltipLayer>
        <TooltipContent className={styles.content}>{text}</TooltipContent>
        <TooltipArrow />
      </TooltipLayer>
    </Tooltip>
  );
}
