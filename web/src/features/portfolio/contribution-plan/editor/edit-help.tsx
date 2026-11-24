import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import { HelpPopover } from "@/ui/display/help-popover";

// The help button of the section title: the rules of edit mode in one popover.
export function EditHelp() {
  const t = useT();

  return (
    <HelpPopover label={t("contributionPlan.helpLabel")}>
      <Text size="sm">{t("contributionPlan.help")}</Text>
      <Text size="sm">{t("contributionPlan.help.rules")}</Text>
    </HelpPopover>
  );
}
