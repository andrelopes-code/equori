import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { useCategoryEntries } from "@/features/categories";
import { reimbursementCandidatesQuery } from "@/features/transactions/api";
import { reimbursementState } from "@/features/transactions/model/reimbursement";
import { ReimbursementCategory } from "@/features/transactions/reimbursement/reimbursement-category";
import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { ReimbursementExactMatch } from "@/features/transactions/reimbursement/reimbursement-exact-match";
import { ReimbursementFooter } from "@/features/transactions/reimbursement/reimbursement-footer";
import { ReimbursementList } from "@/features/transactions/reimbursement/reimbursement-list";
import { ReimbursementNotice } from "@/features/transactions/reimbursement/reimbursement-notice";
import { ReimbursementPlaceholder } from "@/features/transactions/reimbursement/reimbursement-placeholder";
import { ReimbursementScore } from "@/features/transactions/reimbursement/reimbursement-score";
import { useReimbursementDraft } from "@/features/transactions/reimbursement/use-reimbursement-draft";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

export interface ReimbursementDialogProps {
  transaction: Transaction;
  accounts: readonly Account[];
  scale: (code: string) => number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// A117, docs/specs/2026-11-22-reimbursement-dialog-design.md: the score of the inflow on top,
// then one row per expense it may repay.
export function ReimbursementDialog({
  transaction,
  accounts,
  scale,
  open,
  onOpenChange,
}: ReimbursementDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const candidates = useQuery({
    ...reimbursementCandidatesQuery(api, transaction.id),
    enabled: open,
  });
  const entries = useCategoryEntries(accounts);
  const inflow = reimbursementState(
    transaction,
    new Map(accounts.map((a) => [a.id, a])),
  ).amount;
  const items = candidates.data?.items ?? [];
  const draft = useReimbursementDraft(transaction, items, inflow, onOpenChange);

  const incomeIds = useMemo(
    () => new Set(entries.filter((e) => e.class === "income").map((e) => e.id)),
    [entries],
  );
  const currency = transaction.balancing_currency;
  const suggestion = candidates.data?.suggestion ?? [];
  const listed = candidates.isSuccess && items.length > 0;
  const empty = candidates.isSuccess && items.length === 0;
  const unchecked = draft.rows.every((row) => !row.checked);

  function handleApplyMatch() {
    draft.checkAll(suggestion);
  }

  function handleClose() {
    draft.change(false);
  }

  function handleRetry() {
    void candidates.refetch();
  }

  return (
    <Dialog open={open} onOpenChange={draft.change} size="md">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reimbursement.title")}</DialogTitle>
          <DialogDescription>
            <span className={styles.context}>
              {t("reimbursement.context", {
                description: transaction.description,
                date: formatDate(transaction.date, locale),
              })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className={styles.body}>
            {candidates.isPending && (
              <ReimbursementPlaceholder
                inflow={inflow}
                currency={currency}
                scale={scale(currency)}
              />
            )}

            {candidates.isError && (
              <ReimbursementNotice
                title={t("reimbursement.failedTitle")}
                text={t("reimbursement.failed")}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    tone="secondary"
                    onClick={handleRetry}
                  >
                    {t("reimbursement.retry")}
                  </Button>
                }
              />
            )}

            {empty && (
              <ReimbursementNotice
                title={t("reimbursement.emptyTitle")}
                text={t("reimbursement.empty")}
              />
            )}

            {listed && (
              <ReimbursementScore
                inflow={inflow}
                currency={currency}
                scale={scale(currency)}
                totals={draft.totals}
                status={draft.status}
              />
            )}

            {listed && unchecked && (
              <ReimbursementExactMatch
                items={items}
                suggestion={suggestion}
                onApply={handleApplyMatch}
              />
            )}

            {listed && (
              <ReimbursementList
                rows={draft.rows}
                scale={scale}
                onCheckedChange={draft.toggle}
                onAmountChange={draft.setAmount}
              />
            )}

            {listed && (
              <ReimbursementCategory
                value={draft.categoryId}
                exclude={incomeIds}
                onChange={draft.setCategoryId}
              />
            )}
          </div>
        </DialogBody>

        <ReimbursementFooter
          listless={candidates.isError || empty}
          clearable={listed && draft.hadLinks}
          pending={draft.pending}
          ready={draft.ready}
          onClear={draft.clear}
          onClose={handleClose}
          onSubmit={draft.submit}
        />
      </DialogContent>
    </Dialog>
  );
}
