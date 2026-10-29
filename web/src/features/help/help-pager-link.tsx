import { Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { splitHelpPage } from "@/features/help/help-pages";
import { useHelpPage } from "@/features/help/use-help-page";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";
import { StepGlyph } from "@/ui/step-glyph";

interface HelpPagerLinkProps {
  id: string;
  direction: "previous" | "next";
}

// One neighbour: which way it lies, and its title as the link.
export function HelpPagerLink({ id, direction }: HelpPagerLinkProps) {
  const t = useT();
  const query = useHelpPage(id);

  if (query.data == null) return null;

  const { title } = splitHelpPage(query.data);
  const end = direction === "next";

  return (
    <Stack gap={1} align={end ? "end" : "start"}>
      <Text size="xs" tone="muted">
        {t(end ? "help.next" : "help.previous")}
      </Text>
      <Link
        underline="hover"
        render={routeTo({ to: "/help/$page", params: { page: id } })}
      >
        <Inline gap={2} align="center" wrap="nowrap">
          {!end && (
            <Icon size="sm">
              <StepGlyph direction="previous" />
            </Icon>
          )}
          <Text size="sm" weight="medium">
            {title}
          </Text>
          {end && (
            <Icon size="sm">
              <StepGlyph direction="next" />
            </Icon>
          )}
        </Inline>
      </Link>
    </Stack>
  );
}
