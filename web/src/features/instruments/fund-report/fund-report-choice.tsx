import { Button } from "@slotted/react/button";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { fundReportListQuery } from "@/features/instruments/api";
import { useLinkFund } from "@/features/instruments/fund-report/use-link-fund";
import { catalogLabel } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface FundReportChoiceProps {
  instrument: components["schemas"]["Instrument"];
}

// FR15: the funds that share the instrument's code, while no report reaches it; a button links
// one. Draws nothing for an instrument with a report or without candidates.
export function FundReportChoice({ instrument }: FundReportChoiceProps) {
  const t = useT();
  const api = useApi();
  const list = useQuery(fundReportListQuery(api, instrument.code)).data;
  const { link, linking, failure } = useLinkFund(instrument);

  if (
    list === undefined ||
    list.items.length > 0 ||
    list.candidates.length === 0
  ) {
    return null;
  }

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fundReport.title")}</SectionHeading>
          <SectionDescription>
            {t("fundReport.choice.line", {
              count: list.candidates.length,
              code: instrument.code,
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={6}>
          <List aria-label={t("fundReport.choice.list")} variant="framed">
            {list.candidates.map((c) => (
              <ListItem key={`${c.source}:${c.identifier}`}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{c.name}</ListItemLabel>
                    <ListItemDescription>
                      {[c.segment, c.identifier]
                        .filter((part) => part !== "")
                        .join(" · ")}
                    </ListItemDescription>
                  </ListItemBody>
                  <ListItemEnd>
                    {catalogLabel(t, `marketData.feed.${c.source}`, c.source)}
                  </ListItemEnd>
                </ListItemContent>
                <ListItemActions>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={linking}
                    aria-label={t("fundReport.choice.linkNamed", {
                      name: c.name,
                    })}
                    onClick={() => {
                      link(c.source, c.identifier);
                    }}
                  >
                    {t("fundReport.choice.link")}
                  </Button>
                </ListItemActions>
              </ListItem>
            ))}
          </List>

          {failure !== null && <FormNotice>{failure}</FormNotice>}
        </Stack>
      </SectionBody>
    </Section>
  );
}
