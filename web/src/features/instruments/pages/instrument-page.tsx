import { ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { instrumentQuery, termsQuery } from "@/features/instruments/api";
import { InstrumentPagePlaceholder } from "@/features/instruments/pages/instrument-page-placeholder";
import { InstrumentPositions } from "@/features/instruments/positions/instrument-positions";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/model/instrument-labels";
import { InstrumentData } from "@/features/instruments/data/instrument-data";
import { InstrumentPrices } from "@/features/instruments/quote/instrument-prices";
import { InstrumentSources } from "@/features/instruments/sources/instrument-sources";
import { EditInstrumentDialog } from "@/features/instruments/edit-instrument/edit-instrument-dialog";
import { RemoveInstrumentAction } from "@/features/instruments/remove-instrument/remove-instrument-action";
import { RecordPriceDialog } from "@/features/instruments/record-price/record-price-dialog";
import { TermsDialog } from "@/features/instruments/terms/terms-dialog";
import { TermsSection } from "@/features/instruments/terms/terms-section";
import { quoteOf } from "@/features/instruments/model/quote";
import {
  historyPending,
  historyPollMs,
} from "@/features/instruments/model/use-history-refresh";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/navigation/header-action";
import { QueryError } from "@/ui/feedback/query-error";
import { PageBack } from "@/ui/navigation/page-back";

// PC19: one instrument: what the book holds of it, its price history, its terms and its data, with
// the manual price form and the edit form of a security.
export function InstrumentPage() {
  const t = useT();
  const api = useApi();
  const { code } = useParams({ from: "/_authed/instruments/$code" });
  const instrument = useQuery({
    ...instrumentQuery(api, code),
    refetchInterval: (query) =>
      historyPending(query.state.data?.coverage) ? historyPollMs : false,
  });
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const [recording, setRecording] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const [editing, setEditing] = useState(false);
  const fixedIncome = instrument.data?.type === "fixed_income";
  const terms = useQuery({ ...termsQuery(api, code), enabled: fixedIncome });
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
    return <InstrumentPagePlaceholder />;
  const i = instrument.data;
  const quote = quoteOf(i, base);
  const subheading = [
    i.code,
    typeLabel(t, i.type),
    i.subtype === undefined ? null : subtypeLabel(t, i.subtype),
    i.exchange,
    i.quote_currency,
  ]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(" · ");
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/instruments" />}>
            {t("nav.instruments")}
          </PageBack>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{i.name}</PageHeaderHeading>
              <PageHeaderSubheading>{subheading}</PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              {i.type !== "currency" && (
                <HeaderAction
                  label={t("instrument.edit")}
                  glyph="pencil"
                  wordsOnly
                  onClick={() => {
                    setEditing(true);
                  }}
                />
              )}
              <RemoveInstrumentAction instrument={i} />
              {fixedIncome && quote !== null && terms.data !== undefined && (
                <HeaderAction
                  label={t(terms.data === null ? "terms.set" : "terms.change")}
                  glyph="calendar"
                  wordsOnly
                  onClick={() => {
                    setEditingTerms(true);
                  }}
                />
              )}
              {fixedIncome && i.owned && (
                <ButtonLink
                  variant="ghost"
                  render={(props) => (
                    <Link
                      {...props}
                      to="/transactions/new"
                      search={{ kind: "fixed_income", instrument: i.code }}
                    />
                  )}
                >
                  {t("fixedIncome.addMoney")}
                </ButtonLink>
              )}
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
          <InstrumentPrices instrument={i} quote={quote} />

          <InstrumentPositions code={i.code} quote={quote} />
          {fixedIncome && terms.isError && (
            <QueryError
              error={terms.error}
              onRetry={() => void terms.refetch()}
            />
          )}
          {fixedIncome && quote !== null && terms.data !== undefined && (
            <TermsSection code={i.code} terms={terms.data} quote={quote} />
          )}
          <InstrumentData
            instrument={i}
            quote={quote}
            onRecord={() => {
              setRecording(true);
            }}
          />

          <InstrumentSources instrument={i} base={base} />
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
      {editing && (
        <EditInstrumentDialog
          instrument={i}
          onDone={() => {
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      )}
      {editingTerms && quote !== null && terms.data !== undefined && (
        <TermsDialog
          code={i.code}
          quote={quote}
          scale={i.scale}
          terms={terms.data}
          onDone={() => {
            setEditingTerms(false);
          }}
          onCancel={() => {
            setEditingTerms(false);
          }}
        />
      )}
    </Page>
  );
}
