import type { ReactNode } from "react";

import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverLayer,
  PopoverTrigger,
} from "@slotted/react/popover";
import { Stack } from "@slotted/react/stack";

import styles from "@/ui/display/help-popover.module.css";

interface HelpPopoverProps {
  // The accessible name of the trigger and of the text it opens.
  label: string;
  size?: "md" | "lg";
  children: ReactNode;
}

// The question mark beside a title whose explanation takes paragraphs or links: a press opens it.
// A single sentence about a term is a HelpTip.
export function HelpPopover({ label, size, children }: HelpPopoverProps) {
  return (
    <Popover size={size} presentation="auto">
      <PopoverTrigger
        render={(props) => (
          <IconButton
            {...props}
            inline
            variant="ghost"
            tone="secondary"
            aria-label={label}
            className={styles.trigger}
          >
            <Icon>
              <Glyph name="circle-question" />
            </Icon>
          </IconButton>
        )}
      />
      <PopoverLayer>
        <PopoverContent aria-label={label}>
          <PopoverBody>
            <Stack gap={3}>{children}</Stack>
          </PopoverBody>
        </PopoverContent>
        <PopoverArrow />
      </PopoverLayer>
    </Popover>
  );
}
