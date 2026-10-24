import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { instrumentQuery } from "@/features/instruments/api";
import { InstrumentPositions } from "@/features/instruments/instrument-positions";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/instrument-labels";
import { PriceHistory } from "@/features/instruments/price-history";
import { RecordPriceDialog } from "@/features/instruments/record-price-dialog";
import { quoteOf } from "@/features/instruments/use-latest-prices";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";

// One instrument: its data, its price history, the positions that hold it and the manual price form.
export function InstrumentPage() {
  const t = useT();
  const api = useApi();
  const { code } = useParams({ from: "/_authed/instruments/$code" });
  const instrument = useQuery(instrumentQuery(api, code));
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const [recording, setRecording] = useState(false);
  if (instrument.isError)
    return (
      <Page width="full">
        <PageBody>
          <QueryError
            error={instrument.error}
            onRetry={() => void instrument.refetch()}
          />
        </PageBody>
      </Page>
    );
  if (instrument.data === undefined || base === undefined)
    return (
      <Page width="full" loading>
        <PageBody>
          <SkeletonText lines={6} />
        </PageBody>
      </Page>
    );
  const i = instrument.data;
  const quote = quoteOf(i, base);
  const subheading = `${i.code} · ${typeLabel(t, i.type)}`;
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderNav>
            <PageHeaderBack
              render={(props) => <Link {...props} to="/instruments" />}
            >
              {t("nav.instruments")}
            </PageHeaderBack>
          </PageHeaderNav>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{i.name}</PageHeaderHeading>
              <PageHeaderSubheading>{subheading}</PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              {quote !== null && (
                <HeaderAction
                  primary
                  label={t("instrument.price.record")}
                  glyph="plus"
                  onClick={() => {
                    setRecording(true);
                  }}
                />
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          <DescriptionList layout="stack" aria-label={t("instrument.facts")}>
            {[
              [t("instruments.col.code"), i.code],
              [
                t("instruments.col.subtype"),
                i.subtype === undefined ? "" : subtypeLabel(t, i.subtype),
              ],
              [t("instruments.col.quote"), i.quote_currency ?? ""],
              [t("instruments.col.exchange"), i.exchange ?? ""],
              [t("instruments.field.scale"), String(i.scale)],
            ]
              .filter(([, value]) => value !== "")
              .map(([term, value]) => (
                <DescriptionListItem key={term}>
                  <DescriptionListTerm>{term}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {value}
                  </DescriptionListDescription>
                </DescriptionListItem>
              ))}
          </DescriptionList>
          <Stack gap={3}>
            <Heading level={2} size="md">
              {t("instrument.prices.title")}
            </Heading>
            {quote === null ? (
              <Text tone="muted">{t("instrument.prices.noQuote")}</Text>
            ) : (
              <PriceHistory instrument={i.code} quote={quote} />
            )}
          </Stack>
          <Stack gap={3}>
            <Heading level={2} size="md">
              {t("instrument.positions.title")}
            </Heading>
            <InstrumentPositions code={i.code} />
          </Stack>
        </Stack>
      </PageBody>
      {recording && quote !== null && (
        <RecordPriceDialog
          instrument={i.code}
          quote={quote}
          onDone={() => {
            setRecording(false);
          }}
          onCancel={() => {
            setRecording(false);
          }}
        />
      )}
    </Page>
  );
}
