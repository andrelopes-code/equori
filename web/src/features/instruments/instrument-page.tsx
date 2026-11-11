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
import { InstrumentFacts } from "@/features/instruments/instrument-facts";
import { InstrumentPagePlaceholder } from "@/features/instruments/instrument-page-placeholder";
import { InstrumentPositions } from "@/features/instruments/instrument-positions";
import { typeLabel } from "@/features/instruments/instrument-labels";
import { InstrumentPrices } from "@/features/instruments/instrument-prices";
import { EditInstrumentDialog } from "@/features/instruments/edit-instrument-dialog";
import { RemoveInstrumentAction } from "@/features/instruments/remove-instrument-action";
import { RecordPriceDialog } from "@/features/instruments/record-price-dialog";
import { TermsDialog } from "@/features/instruments/terms-dialog";
import { TermsSection } from "@/features/instruments/terms-section";
import { quoteOf } from "@/features/instruments/quote";
import {
  historyPending,
  historyPollMs,
} from "@/features/instruments/use-history-refresh";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";
import { PageBack } from "@/ui/page-back";

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
  const subheading = `${i.code} · ${typeLabel(t, i.type)}`;
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
          <InstrumentPrices
            instrument={i}
            quote={quote}
            onRecord={() => {
              setRecording(true);
            }}
          />

          <InstrumentPositions code={i.code} />
          {fixedIncome && terms.isError && (
            <QueryError
              error={terms.error}
              onRetry={() => void terms.refetch()}
            />
          )}
          {fixedIncome && quote !== null && terms.data !== undefined && (
            <TermsSection terms={terms.data} quote={quote} />
          )}
          <InstrumentFacts instrument={i} />
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
