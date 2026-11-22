import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Link } from "@slotted/react/link";
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

const sourceHref = "https://doi.org/10.2307/2672906";

// The help button of the method row: what the evidence supports, in one popover.
export function MethodHelp() {
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
            aria-label={t("contributionPlan.method.piotroski.helpLabel")}
          >
            <Icon>
              <Glyph name="circle-question" />
            </Icon>
          </IconButton>
        )}
      />
      <PopoverLayer>
        <PopoverContent
          aria-label={t("contributionPlan.method.piotroski.helpLabel")}
        >
          <PopoverBody>
            <Stack gap={3}>
              <Text size="sm">
                {t("contributionPlan.method.piotroski.what")}
              </Text>
              <Text size="sm">
                {t("contributionPlan.method.piotroski.after")}
              </Text>
              <Text size="sm">
                {t("contributionPlan.method.piotroski.limit")}
              </Text>
              <Text size="sm">
                <Link external href={sourceHref} rel="noreferrer">
                  {t("contributionPlan.method.piotroski.source")}
                </Link>
              </Text>
            </Stack>
          </PopoverBody>
        </PopoverContent>
        <PopoverArrow />
      </PopoverLayer>
    </Popover>
  );
}
