import { Button, IconButton } from "@slotted/react/button";
import {
  DetailPanel,
  DetailPanelBody,
  DetailPanelSection,
} from "@slotted/react/detail-panel";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
  PageHeaderVisual,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Tag } from "@slotted/react/tag";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import { CategoryMark, useCategoryEntries } from "@/features/categories";
import { DetailActions } from "@/features/transactions/detail-actions";
import { AttachmentsSection } from "@/features/transactions/attachments-section";
import { CategorySection } from "@/features/transactions/category-section";
import { HistorySection } from "@/features/transactions/history-section";
import { LinksSection } from "@/features/transactions/links-section";
import { PostingsTable } from "@/features/transactions/postings-table";
import { TransactionFacts } from "@/features/transactions/transaction-facts";
import { transactionRow } from "@/features/transactions/transaction-row";
import { TransferDialog } from "@/features/transactions/transfer-dialog";
import { useTransactionData } from "@/features/transactions/use-transaction-data";
import { VoidDialog } from "@/features/transactions/void-dialog";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

// One transaction as a page of its own (level 1) or as the pane beside the list.
export function TransactionDetail({
  id,
  host,
  onClose,
}: {
  id: string;
  host: "page" | "pane";
  onClose?: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const data = useTransactionData(id);
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);
  const [voiding, setVoiding] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const ready = data.status === "ready" ? data : undefined;
  const entries = useCategoryEntries(ready?.accounts);
  const categories = useMemo(
    () => new Map(entries.map((c) => [c.id, c])),
    [entries],
  );
  const accounts = useMemo(
    () => new Map((ready?.accounts ?? []).map((a) => [a.id, a])),
    [ready?.accounts],
  );

  const close =
    host === "pane" && onClose !== undefined ? (
      <IconButton
        aria-label={t("detail.close")}
        variant="ghost"
        tone="secondary"
        onClick={onClose}
      >
        <Icon>
          <Glyph name="x" />
        </Icon>
      </IconButton>
    ) : null;
  // Below 1024 px the shell's top app bar carries the way back.
  const back =
    host === "page" && wide ? (
      <PageHeaderNav>
        <PageHeaderBack
          render={(props) => <Link {...props} to="/transactions" />}
        >
          {t("nav.transactions")}
        </PageHeaderBack>
      </PageHeaderNav>
    ) : null;

  if (ready === undefined) {
    const notFound =
      data.status === "error" &&
      data.error instanceof ProblemError &&
      data.error.status === 404;
    return (
      <DetailPanel
        level={host === "page" ? "1" : "2"}
        scroll={host === "pane" ? "self" : "ancestor"}
        loading={data.status === "loading"}
        status={
          data.status === "error" ? (notFound ? "not-found" : "error") : "ready"
        }
      >
        <PageHeader loading={data.status === "loading"}>
          <PageHeaderTitleArea>
            {back}
            <PageHeaderTitleRow>
              <PageHeaderTitle>
                <PageHeaderHeading>{t("detail.title")}</PageHeaderHeading>
              </PageHeaderTitle>
              {close !== null && <PageHeaderActions>{close}</PageHeaderActions>}
            </PageHeaderTitleRow>
          </PageHeaderTitleArea>
        </PageHeader>
        <DetailPanelBody
          message={
            data.status === "error" ? (
              <ResultState status={notFound ? "not-found" : "error"}>
                <ResultStateContent>
                  <ResultStateTitle>
                    {notFound ? t("detail.notFound") : t("detail.loadFailed")}
                  </ResultStateTitle>
                  <ResultStateDescription>
                    {notFound
                      ? t("detail.notFoundHint")
                      : errorText(data.error, t)}
                  </ResultStateDescription>
                </ResultStateContent>
                {!notFound && (
                  <ResultStateActions>
                    <Button
                      variant="outline"
                      tone="secondary"
                      onClick={data.retry}
                    >
                      {t("transactions.tryAgain")}
                    </Button>
                  </ResultStateActions>
                )}
              </ResultState>
            ) : undefined
          }
        />
      </DetailPanel>
    );
  }

  const tx = ready.transaction;
  const payees = new Map(ready.payees.map((p) => [p.id, p.name]));
  const row = transactionRow(tx, accounts, payees);
  const first = categories.get(row.categoryIds[0] ?? "");
  const voided = tx.voided_at !== undefined;
  const pending = tx.postings.some((p) => p.status === "pending");
  const amount = formatMoney(
    row.money,
    ready.scale(row.money.currency),
    locale,
  );
  const hasLinks = tx.links.length > 0 || (tx.referenced_by ?? []).length > 0;

  return (
    <DetailPanel
      recordKey={tx.id}
      level={host === "page" ? "1" : "2"}
      scroll={host === "pane" ? "self" : "ancestor"}
    >
      <PageHeader>
        <PageHeaderTitleArea>
          {back}
          <PageHeaderTitleRow>
            <PageHeaderVisual>
              <CategoryMark
                name={first?.name ?? row.title}
                color={first?.color}
                icon={first?.icon}
                size="lg"
              />
            </PageHeaderVisual>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {row.title || t("transactions.untitled")}
              </PageHeaderHeading>
              <PageHeaderSubheading>
                {[amount, formatDate(tx.date, locale), row.accounts]
                  .filter((part) => part !== "")
                  .join(" · ")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderMarks>
              {voided && (
                <Tag size="sm" tone="danger">
                  {t("transactions.voided")}
                </Tag>
              )}
              {pending && !voided && (
                <Tag size="sm" tone="warning">
                  {t("posting.status.pending")}
                </Tag>
              )}
            </PageHeaderMarks>
            <PageHeaderActions>
              <DetailActions
                host={host}
                voided={voided}
                transfer={row.transfer}
                onCorrect={() => {
                  void navigate({
                    to: "/transactions/$id/correct",
                    params: { id: tx.id },
                  });
                }}
                onTransfer={() => {
                  setTransferring(true);
                }}
                onVoid={() => {
                  setVoiding(true);
                }}
                onOpenPage={() => {
                  void navigate({
                    to: "/transactions/$id",
                    params: { id: tx.id },
                  });
                }}
                onClose={onClose}
              />
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <DetailPanelBody
        aside={
          <TransactionFacts
            transaction={tx}
            payee={
              tx.payee_id === undefined ? undefined : payees.get(tx.payee_id)
            }
          />
        }
      >
        {!row.transfer && (
          <DetailPanelSection name="category" label={t("detail.category")}>
            <CategorySection
              transaction={tx}
              accounts={accounts}
              categories={categories}
              scale={ready.scale}
            />
          </DetailPanelSection>
        )}
        <DetailPanelSection
          name="postings"
          label={t("detail.postings")}
          count={tx.postings.length}
        >
          <PostingsTable
            postings={tx.postings}
            accounts={accounts}
            categories={categories}
            scale={ready.scale}
          />
        </DetailPanelSection>
        {hasLinks && (
          <DetailPanelSection name="links" label={t("detail.links")}>
            <LinksSection transaction={tx} />
          </DetailPanelSection>
        )}
        <DetailPanelSection name="attachments" label={t("detail.attachments")}>
          <AttachmentsSection transactionId={tx.id} readOnly={voided} />
        </DetailPanelSection>
        <DetailPanelSection name="history" label={t("detail.history")}>
          <HistorySection transaction={tx} />
        </DetailPanelSection>
      </DetailPanelBody>
      <VoidDialog transaction={tx} open={voiding} onOpenChange={setVoiding} />
      <TransferDialog
        transaction={tx}
        accounts={ready.accounts}
        open={transferring}
        onOpenChange={setTransferring}
      />
    </DetailPanel>
  );
}
