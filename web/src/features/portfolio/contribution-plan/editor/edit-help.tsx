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
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// The help button of the section title: the rules of edit mode in one popover.
export function EditHelp() {
  const t = useT();

  return (
    <Popover>
      <PopoverTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("contributionPlan.helpLabel")}
          >
            <Icon>
              <Glyph name="circle-question" />
            </Icon>
          </IconButton>
        )}
      />
      <PopoverLayer>
        <PopoverContent aria-label={t("contributionPlan.helpLabel")}>
          <PopoverBody>
            <Text size="sm">{t("contributionPlan.help")}</Text>
          </PopoverBody>
        </PopoverContent>
        <PopoverArrow />
      </PopoverLayer>
    </Popover>
  );
}
