import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import { HelpPopover } from "@/ui/display/help-popover";

const sourceHref = "https://doi.org/10.2307/2672906";

// The help button of the method row: what the evidence supports, in one popover.
export function MethodHelp() {
  const t = useT();

  return (
    <HelpPopover label={t("contributionPlan.method.piotroski.helpLabel")}>
      <Text size="sm">{t("contributionPlan.method.piotroski.what")}</Text>
      <Text size="sm">{t("contributionPlan.method.piotroski.after")}</Text>
      <Text size="sm">{t("contributionPlan.method.piotroski.limit")}</Text>
      <Text size="sm">
        <Link external href={sourceHref} rel="noreferrer">
          {t("contributionPlan.method.piotroski.source")}
        </Link>
      </Text>
    </HelpPopover>
  );
}
