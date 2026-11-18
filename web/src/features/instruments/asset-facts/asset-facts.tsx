import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  companyReportsQuery,
  fundReportsQuery,
  instrumentQuery,
} from "@/features/instruments/api";
import { assetFactsText } from "@/features/instruments/asset-facts/asset-facts-text";
import { companyFigures } from "@/features/instruments/company-report/company-figures";
import { useFundReport } from "@/features/instruments/fund-report/use-fund-report";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AssetFactsProps {
  code: string;
}

// One muted line with the figures of the fund report or of the company report of an instrument.
// Draws nothing while a source is loading.
export function AssetFacts({ code }: AssetFactsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const instrument = useQuery(instrumentQuery(api, code));
  const funds = useQuery(fundReportsQuery(api, code));
  const companies = useQuery(companyReportsQuery(api, code));
  const { figures } = useFundReport(
    code,
    instrument.data?.quote_currency ?? null,
  );

  if (instrument.isPending || funds.isPending || companies.isPending) {
    return null;
  }

  const report = companies.data?.[0];
  const text = assetFactsText(
    {
      fund: figures,
      company: report === undefined ? null : companyFigures(report),
    },
    t,
    locale,
  );

  return (
    <Text size="sm" tone="muted" truncate title={text}>
      {text}
    </Text>
  );
}
