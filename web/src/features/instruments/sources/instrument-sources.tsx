import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { sourceLinks } from "@/features/instruments/sources/source-links";
import { catalogLabel } from "@/features/setup";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentSourcesProps {
  instrument: Instrument;
  base: string;
}

// Design 2026-11-13: the external pages that show the instrument, drawn only when one exists.
export function InstrumentSources({
  instrument,
  base,
}: InstrumentSourcesProps) {
  const t = useT();
  const { locale } = useAppLocaleState();
  const links = sourceLinks(instrument, { region: locale.region, base });

  if (links.length === 0) return null;

  return (
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("instrument.links.title")}
      </Heading>

      <Text size="sm" tone="muted">
        {t("instrument.links.hint")}
      </Text>

      <List aria-label={t("instrument.links.title")} variant="framed">
        {links.map((link) => (
          <ListItem key={link.id}>
            <ListItemLink
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ListItemBody>
                <ListItemLabel>
                  {catalogLabel(t, `instrument.link.${link.id}`, link.id)}
                </ListItemLabel>
                <ListItemDescription>
                  {catalogLabel(t, `instrument.link.${link.id}.job`, "")}
                </ListItemDescription>
              </ListItemBody>
              <ListItemEnd>{link.host}</ListItemEnd>
            </ListItemLink>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
