import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { CheckboxGroup } from "@slotted/react/checkbox-group";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { transactionSuggestionsQuery } from "@/features/transactions/api";
import { useT } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

export function SuggestCategoriesDialog({
  transactions,
  categoriesById,
  onOpenChange,
  onRecord,
}: {
  transactions: readonly Transaction[];
  categoriesById: Map<string, CategoryEntry>;
  onOpenChange: (open: boolean) => void;
  onRecord: (
    accepted: { transaction: Transaction; categoryId: string }[],
  ) => void;
}) {
  const t = useT();
  const api = useApi();
  const [ids] = useState(() => transactions.map((tx) => tx.id));
  const suggestions = useQuery(transactionSuggestionsQuery(api, ids));
  const named = transactions.flatMap((transaction, i) => {
    const categoryId = suggestions.data?.items[i]?.category_id;
    const category =
      categoryId === undefined ? undefined : categoriesById.get(categoryId);
    return category === undefined ? [] : [{ transaction, category }];
  });
  // A suggestion is accepted until the reader unchecks it.
  const [rejected, setRejected] = useState<readonly string[]>([]);
  const accepted = named.filter(
    ({ transaction }) => !rejected.includes(transaction.id),
  );
  const allIds = named.map(({ transaction }) => transaction.id);
  return (
    <Dialog open onOpenChange={onOpenChange} size="md">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("suggest.title")}</DialogTitle>
          <DialogDescription>{t("suggest.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Text size="sm" tone="muted">
              {t("suggest.sends")}
            </Text>
            {suggestions.isPending ? (
              <SkeletonText lines={transactions.length} />
            ) : suggestions.isError ? (
              <InlineMessage tone="danger">
                {errorText(suggestions.error, t)}
              </InlineMessage>
            ) : (
              <>
                {!suggestions.data.available && (
                  <Alert tone="warning">
                    <AlertContent>
                      <AlertDescription>
                        {t("suggest.unavailable")}
                      </AlertDescription>
                    </AlertContent>
                  </Alert>
                )}
                {named.length > 0 && (
                  <CheckboxGroup
                    aria-label={t("suggest.list")}
                    allValues={allIds}
                    value={allIds.filter((id) => !rejected.includes(id))}
                    onValueChange={(value) => {
                      setRejected(allIds.filter((id) => !value.includes(id)));
                    }}
                  >
                    {named.map(({ transaction, category }) => (
                      <Checkbox key={transaction.id} value={transaction.id}>
                        {t("suggest.option", {
                          description: transaction.description,
                          category: category.path,
                        })}
                      </Checkbox>
                    ))}
                  </CheckboxGroup>
                )}
                {transactions.length > named.length && (
                  <Text size="sm" tone="muted">
                    {t("suggest.without", {
                      count: transactions.length - named.length,
                    })}
                  </Text>
                )}
              </>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            tone="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("detail.cancel")}
          </Button>
          <Button
            disabled={accepted.length === 0}
            onClick={() => {
              onRecord(
                accepted.map(({ transaction, category }) => ({
                  transaction,
                  categoryId: category.id,
                })),
              );
            }}
          >
            {t("suggest.record", { count: accepted.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
