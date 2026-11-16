import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import { indicatorFigures } from "@/features/accounts/institution/indicator-figures";
import { InstitutionFigure } from "@/features/accounts/institution/institution-figure";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureGrid } from "@/ui/display/figure-grid";

type InstitutionIndicators = components["schemas"]["InstitutionIndicators"];

interface InstitutionTabProps {
  indicators: InstitutionIndicators;
  scale: (code: string) => number;
}

// A237: the prudential figures of the institution's conglomerate, as the Banco Central publishes
// them, with the data-base and a link to where they can be checked.
export function InstitutionTab({ indicators, scale }: InstitutionTabProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const figures = indicatorFigures(indicators);
  const newest = indicators.periods[0]?.period ?? "";

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("institution.title")}</SectionHeading>
          <SectionDescription>
            {t("institution.description", {
              name: indicators.conglomerate_name,
              period: formatReferenceMonth(newest.slice(0, 7), locale),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={6}>
          <FigureGrid label={t("institution.title")}>
            {figures.map((figure) => (
              <InstitutionFigure
                key={figure.id}
                figure={figure}
                currency={indicators.currency}
                scale={scale}
              />
            ))}
          </FigureGrid>

          <Text size="sm" tone="muted">
            {t("institution.floorRule", { rule: indicators.limits.rule })}
          </Text>

          <List aria-label={t("institution.title")} variant="framed">
            <ListItem>
              <ListItemLink
                href={indicators.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListItemBody>
                  <ListItemLabel>{t("institution.link")}</ListItemLabel>
                  <ListItemDescription>
                    {t("institution.link.job")}
                  </ListItemDescription>
                </ListItemBody>
              </ListItemLink>
            </ListItem>
          </List>
        </Stack>
      </SectionBody>
    </Section>
  );
}
