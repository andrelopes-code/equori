import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";
import { useCallback } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  similarTransactions,
  useBulkCategorize,
  useCategorizeTransaction,
} from "@/features/transactions/api";
import {
  categoryParts,
  currentParts,
  similarSearch,
  summarizeBulk,
} from "@/features/transactions/categorize";
import type { BulkSummary } from "@/features/transactions/categorize";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const refusalWords: Record<string, MessageKey> = {
  version_conflict: "categorize.refused.version_conflict",
  transaction_voided: "categorize.refused.transaction_voided",
  not_categorizable: "categorize.refused.not_categorizable",
  not_found: "categorize.refused.not_found",
};

export interface CategorizeActions {
  categorizeOne: (tx: Transaction, category: CategoryEntry) => Promise<void>;
  categorizeMany: (
    items: readonly Transaction[],
    category: CategoryEntry,
  ) => Promise<BulkSummary>;
}

export function useCategorizeActions(
  accounts: Map<string, Account>,
): CategorizeActions {
  const t = useT();
  const api = useApi();
  const single = useCategorizeTransaction();
  const bulk = useBulkCategorize();

  const report = useCallback(
    (summary: BulkSummary, category: CategoryEntry) => {
      const refused = summary.refused.map(({ status, count }) =>
        t(refusalWords[status] ?? "categorize.refused.other", { count }),
      );
      toast.show({
        tone: refused.length === 0 ? "success" : "warning",
        title: t("categorize.bulkDone", {
          count: summary.categorized,
          category: category.name,
        }),
        ...(refused.length === 0 ? {} : { description: refused.join(" ") }),
      });
    },
    [t],
  );

  const categorizeMany = useCallback(
    async (items: readonly Transaction[], category: CategoryEntry) => {
      const results = await bulk.mutateAsync({
        categoryId: category.id,
        items: items.map((tx) => ({ id: tx.id, expected_version: tx.version })),
      });
      const summary = summarizeBulk(results);
      report(summary, category);
      return summary;
    },
    [bulk, report],
  );

  const categorizeOne = useCallback(
    async (tx: Transaction, category: CategoryEntry) => {
      const previous = currentParts(tx, accounts);
      const next = await single.mutateAsync({
        current: tx,
        parts: categoryParts(tx, accounts, category.id),
      });
      const id = `categorized-${tx.id}`;
      const undo = (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            toast.dismiss(id);
            void single.mutateAsync({ current: next, parts: previous });
          }}
        >
          {t("categorize.undo")}
        </Button>
      );
      const title = t("categorize.done", { category: category.path });
      toast.show({ id, tone: "success", title, actions: undo, duration: 8000 });

      const search = similarSearch(tx);
      if (search === null) return;
      const similar = (await similarTransactions(api, search)).filter(
        (other) => other.id !== tx.id && other.voided_at === undefined,
      );
      if (similar.length === 0) return;
      toast.show({
        id,
        tone: "success",
        title,
        duration: 12000,
        actions: (
          <>
            {undo}
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={() => {
                toast.dismiss(id);
                void categorizeMany(similar, category);
              }}
            >
              {t("categorize.applySimilar", { count: similar.length })}
            </Button>
          </>
        ),
      });
    },
    [accounts, api, categorizeMany, single, t],
  );

  return { categorizeOne, categorizeMany };
}
