import { Button } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { useComparableIndexes } from "@/features/calculators";
import { changeText, fundReportsQuery } from "@/features/instruments";
import { useReservedFor } from "@/features/portfolio/contribution-plan/ideal/use-reserved-for";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { CompanyReportDialog } from "@/features/portfolio/contribution-plan/month/company-report-dialog";
import { CompareIndexersDialog } from "@/features/portfolio/contribution-plan/month/compare-indexers-dialog";
import { FundReportDialog } from "@/features/portfolio/contribution-plan/month/fund-report-dialog";
import { FactLine } from "@/features/portfolio/contribution-plan/panel/fact-line";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Figures = components["schemas"]["CompanyFigures"];

interface AssetFactsProps {
  // The asset; an account has no code.
  member: { account_id?: string; instrument?: string };
  entry: ShoppingEntry | undefined;
  company: Figures | undefined;
  currency: string;
  // Divides the group among its assets; undefined where it is divided.
  onSplit: (() => void) | undefined;
}

type Opened = "company" | "fund" | "indexers";

// What the screen knows of the asset beside its criteria: the profit of the company, the report of the
// fund, the goal that holds it, and the comparison of a purchase by value.
export function AssetFacts({
  member,
  entry,
  company,
  currency,
  onSplit,
}: AssetFactsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const code = member.instrument;
  const reports = useQuery({
    ...fundReportsQuery(api, code ?? ""),
    enabled: code !== undefined,
  }).data;
  const indexes = useComparableIndexes(currency);
  const reserved = useReservedFor(member);
  const [opened, setOpened] = useState<Opened>();

  const fund = code !== undefined && (reports?.length ?? 0) > 0;
  const compares = entry?.byValue === true && indexes.length > 0;
  const nothing =
    company === undefined &&
    !fund &&
    !compares &&
    reserved === undefined &&
    onSplit === undefined;

  function close() {
    setOpened(undefined);
  }

  if (nothing) return null;

  return (
    <div className={styles.facts}>
      {company !== undefined && (
        <FactLine
          label={t("contributionPlan.colProfit")}
          value={changeText(t, locale, company.profit)}
          action={t("contributionPlan.companyReport")}
          onAction={() => {
            setOpened("company");
          }}
        />
      )}

      {fund && (
        <FactLine
          label={t("contributionPlan.fundReport.title")}
          action={t("contributionPlan.fundReport")}
          onAction={() => {
            setOpened("fund");
          }}
        />
      )}

      {compares && (
        <FactLine
          label={t("contributionPlan.byValue")}
          action={t("contributionPlan.compareIndexers")}
          onAction={() => {
            setOpened("indexers");
          }}
        />
      )}

      {reserved !== undefined && (
        <FactLine
          label={t("contributionPlan.reservedFor", { goal: reserved })}
        />
      )}

      {onSplit !== undefined && (
        <div className={styles.fact}>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onSplit}
          >
            {t("contributionPlan.panel.split")}
          </Button>
        </div>
      )}

      {opened === "company" && code !== undefined && (
        <CompanyReportDialog code={code} open onClose={close} />
      )}

      {opened === "fund" && code !== undefined && (
        <FundReportDialog code={code} quote={currency} open onClose={close} />
      )}

      {opened === "indexers" && entry !== undefined && (
        <CompareIndexersDialog amount={entry.cost} open onClose={close} />
      )}
    </div>
  );
}
