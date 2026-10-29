import { ButtonLink } from "@slotted/react/button";
import { Card, CardBody, CardFooter } from "@slotted/react/card";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { Link } from "@tanstack/react-router";

import { helpPages, splitHelpPage } from "@/features/help/help-pages";
import { useHelpPage } from "@/features/help/use-help-page";
import { useT } from "@/i18n/i18n-provider";

interface HelpFeaturedProps {
  id: string;
}

// The page a newcomer starts from, set apart from the lists below it.
export function HelpFeatured({ id }: HelpFeaturedProps) {
  const t = useT();
  const query = useHelpPage(id);

  if (query.data == null) return null;

  const { title, lead } = splitHelpPage(query.data);
  const kind = helpPages.find((p) => p.id === id)?.kind ?? "tutorial";

  return (
    <Card fill="subtle" size="lg">
      <CardBody>
        <Stack gap={2}>
          <Text size="sm" tone="muted" weight="medium">
            {t(`help.kind.${kind}`)}
          </Text>
          <Heading level={2} size="xl">
            {title}
          </Heading>
          <Text size="md" tone="muted">
            {lead}
          </Text>
        </Stack>
      </CardBody>
      <CardFooter>
        <ButtonLink
          render={(props) => (
            <Link {...props} to="/help/$page" params={{ page: id }} />
          )}
        >
          {t("help.start")}
        </ButtonLink>
      </CardFooter>
    </Card>
  );
}
