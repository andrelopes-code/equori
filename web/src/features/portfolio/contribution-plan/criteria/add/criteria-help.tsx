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

import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const sentences: readonly MessageKey[] = [
  "contributionPlan.criteria.helpWhat",
  "contributionPlan.criteria.helpStudies",
  "contributionPlan.criteria.helpLimit",
];

const sources: readonly { href: string; label: MessageKey }[] = [
  {
    href: "https://repositorio.ufu.br/bitstream/123456789/43908/1/BacktestingEfeitoValor.pdf",
    label: "contributionPlan.criteria.helpPrice",
  },
  {
    href: "https://teses.usp.br/teses/disponiveis/12/12139/tde-25062024-151317/publico/IgorToledodeQueirozCorrigida.pdf",
    label: "contributionPlan.criteria.helpQuality",
  },
  {
    href: "https://www.redalyc.org/journal/1230/123075329001/123075329001.pdf",
    label: "contributionPlan.criteria.helpMethods",
  },
];

// What a criterion does, what the studies found and what they did not test, with their sources.
export function CriteriaHelp() {
  const t = useT();

  return (
    <Popover size="lg">
      <PopoverTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("contributionPlan.criteria.helpLabel")}
          >
            <Icon>
              <Glyph name="circle-question" />
            </Icon>
          </IconButton>
        )}
      />
      <PopoverLayer>
        <PopoverContent aria-label={t("contributionPlan.criteria.helpLabel")}>
          <PopoverBody>
            <Stack gap={3}>
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
            </Stack>
          </PopoverBody>
        </PopoverContent>
        <PopoverArrow />
      </PopoverLayer>
    </Popover>
  );
}
