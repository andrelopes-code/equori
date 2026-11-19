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
            <Stack gap={3}>
              <Text size="sm">{t("contributionPlan.help")}</Text>
              <Text size="sm">{t("contributionPlan.help.rules")}</Text>
            </Stack>
          </PopoverBody>
        </PopoverContent>
        <PopoverArrow />
      </PopoverLayer>
    </Popover>
  );
}
