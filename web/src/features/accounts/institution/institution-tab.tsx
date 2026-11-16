import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
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
import type { IndicatorFigure } from "@/features/accounts/institution/indicator-figures";
import { formatBasisPoints, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/display/figure-card";
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

  function value(figure: IndicatorFigure) {
    if (figure.kind === "ratio") {
      return figure.basisPoints === null
        ? t("institution.notInformed")
        : formatBasisPoints(figure.basisPoints, locale);
    }

    return figure.money === null
      ? t("institution.notInformed")
      : { money: figure.money, scale: scale(figure.money.currency) };
  }

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("institution.title")}</SectionHeading>
          <SectionDescription>
            {t("institution.description", {
              name: indicators.conglomerate_name,
              period: formatReferenceMonth(
                indicators.period.slice(0, 7),
                locale,
              ),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <FigureGrid label={t("institution.title")}>
          {figures.map((figure) => (
            <FigureCard
              key={figure.id}
              label={t(`institution.${figure.id}`)}
              value={value(figure)}
              note={t(`institution.note.${figure.id}`)}
              goodWhen="none"
            />
          ))}
        </FigureGrid>

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
      </SectionBody>
    </Section>
  );
}
