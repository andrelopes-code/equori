import {
  AlertDialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useMergeCategory } from "@/features/categories/api";
import { CategoryPicker } from "@/features/categories/category-picker";
import { subtreeOf } from "@/features/categories/category-paths";
import type { CategoryEntry } from "@/features/categories/category-paths";
import { useT } from "@/i18n/i18n-provider";

// A75: the source's postings, rules and budgets move to the destination, and the source closes.
export function MergeDialog({
  source,
  entries,
  open,
  onOpenChange,
}: {
  source: CategoryEntry;
  entries: readonly CategoryEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const merge = useMergeCategory();
  const [into, setInto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const excluded = subtreeOf(entries, source.id);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("merge.title", { name: source.path })}</DialogTitle>
          <DialogDescription>{t("merge.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Field>
              <FieldLabel>{t("merge.into")}</FieldLabel>
              <CategoryPicker
                value={into}
                amount={source.class === "income" ? 1 : -1}
                exclude={excluded}
                portal={false}
                onChange={setInto}
              />
            </Field>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
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
            tone="danger"
            disabled={into === null}
            loading={merge.isPending}
            onClick={() => {
              if (into === null) return;
              setError(null);
              merge
                .mutateAsync({ id: source.id, into })
                .then(() => {
                  onOpenChange(false);
                })
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("merge.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
