import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { HelpPopover } from "@/ui/display/help-popover";

const sentences: readonly MessageKey[] = [
  "contributionPlan.method.piotroski.what",
  "contributionPlan.method.piotroski.after",
  "contributionPlan.method.piotroski.limit",
];

const sources: readonly { href: string; label: MessageKey }[] = [
  {
    href: "https://doi.org/10.2307/2672906",
    label: "contributionPlan.method.piotroski.source",
  },
  {
    href: "https://doi.org/10.1057/s41260-020-00157-2",
    label: "contributionPlan.method.piotroski.sourceWorld",
  },
  {
    href: "https://doi.org/10.15728/bbr.2022.19.5.1.en",
    label: "contributionPlan.method.piotroski.sourceFor",
  },
  {
    href: "https://doi.org/10.17524/repec.v14i2.2394",
    label: "contributionPlan.method.piotroski.sourceAgainst",
  },
  {
    href: "https://doi.org/10.1111/jofi.12365",
    label: "contributionPlan.method.piotroski.sourceAfter",
  },
];

// The help button of the method row: what the evidence supports and what it does not, in one
// popover with its sources.
export function MethodHelp() {
  const t = useT();

  return (
    <HelpPopover
      size="lg"
      label={t("contributionPlan.method.piotroski.helpLabel")}
    >
      {sentences.map((key) => (
        <Text key={key} size="sm">
          {t(key)}
        </Text>
      ))}

      {sources.map((source) => (
        <Text key={source.href} size="sm">
          <Link external href={source.href} rel="noreferrer">
            {t(source.label)}
          </Link>
        </Text>
      ))}
    </HelpPopover>
  );
}
