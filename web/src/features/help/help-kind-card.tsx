import { Card, CardBody, CardHeader } from "@slotted/react/card";
import { List } from "@slotted/react/list";
import { Heading, Text } from "@slotted/react/typography";

import { HelpIndexItem } from "@/features/help/help-index-item";
import { helpPages } from "@/features/help/help-pages";
import type { HelpKind } from "@/features/help/help-pages";
import { useT } from "@/i18n/i18n-provider";

interface HelpKindCardProps {
  kind: HelpKind;
}

// The pages of one kind, under what the kind answers.
export function HelpKindCard({ kind }: HelpKindCardProps) {
  const t = useT();

  const pages = helpPages.filter((p) => p.kind === kind);

  return (
    <Card>
      <CardHeader>
        <Heading level={2} size="md">
          {t(`help.kind.${kind}`)}
        </Heading>
        <Text size="sm" tone="muted">
          {t(`help.kind.${kind}.description`)}
        </Text>
      </CardHeader>
      <CardBody>
        <List aria-label={t(`help.kind.${kind}`)}>
          {pages.map(({ id }) => (
            <HelpIndexItem key={id} id={id} />
          ))}
        </List>
      </CardBody>
    </Card>
  );
}
