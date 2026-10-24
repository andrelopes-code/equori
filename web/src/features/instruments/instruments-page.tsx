import { Button } from "@slotted/react/button";
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
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { DefineInstrumentDialog } from "@/features/instruments/define-instrument-dialog";
import { groupByType } from "@/features/instruments/instrument-groups";
import { InstrumentsList } from "@/features/instruments/instruments-list";
import { PriceImportDialog } from "@/features/instruments/price-import-dialog";
import { InstrumentsTable } from "@/features/instruments/instruments-table";
import { useLatestPrices } from "@/features/instruments/use-latest-prices";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// The currencies and securities of the instance by type, each with its latest price.
export function InstrumentsPage() {
  const t = useT();
  const api = useApi();
  const compact = useMediaQuery(compactQuery);
  const instruments = useQuery(instrumentsQuery(api));
  const items = useMemo(
    () => instruments.data?.items ?? [],
    [instruments.data],
  );
  const groups = useMemo(() => groupByType(items), [items]);
  const latest = useLatestPrices(items);
  const [defining, setDefining] = useState(false);
  const [importing, setImporting] = useState(false);
  const define = () => {
    setDefining(true);
  };
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.instruments")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("instruments.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <HeaderAction
                label={t("prices.import")}
                glyph="upload"
                onClick={() => {
                  setImporting(true);
                }}
              />
              <HeaderAction
                primary
                label={t("instruments.define")}
                glyph="plus"
                onClick={define}
              />
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {instruments.isError ? (
          <QueryError
            error={instruments.error}
            onRetry={() => void instruments.refetch()}
          />
        ) : !instruments.isPending && items.length === 0 ? (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("instruments.empty")}</ResultStateTitle>
              <ResultStateDescription>
                {t("instruments.emptyHint")}
              </ResultStateDescription>
            </ResultStateContent>
            <ResultStateActions>
              <Button onClick={define}>{t("instruments.define")}</Button>
            </ResultStateActions>
          </ResultState>
        ) : compact ? (
          <InstrumentsList
            groups={groups}
            latest={latest}
            loading={instruments.isPending}
          />
        ) : (
          <InstrumentsTable
            groups={groups}
            latest={latest}
            loading={instruments.isPending}
          />
        )}
      </PageBody>
      {defining && (
        <DefineInstrumentDialog
          onDone={() => {
            setDefining(false);
          }}
          onCancel={() => {
            setDefining(false);
          }}
        />
      )}
      {importing && (
        <PriceImportDialog
          onClose={() => {
            setImporting(false);
          }}
        />
      )}
    </Page>
  );
}
