import { Button } from "@slotted/react/button";
import {
  AlertDialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { tagUsageQuery, useDeleteTag } from "@/features/categories/api";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

// The reader confirms a delete knowing how many transactions lose the tag.
export function DeleteTagDialog({
  tag,
  onDone,
  onCancel,
}: {
  tag: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const usage = useQuery(tagUsageQuery(api, tag));
  const remove = useDeleteTag();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const count = usage.data?.transactions;
  return (
    <AlertDialog open onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("tags.deleteTitle", { name: tag })}</DialogTitle>
          <DialogDescription>
            {count === undefined
              ? t("tags.deleteCounting", { name: tag })
              : count === 1
                ? t("tags.deleteOne", { name: tag })
                : t("tags.deleteMany", {
                    name: tag,
                    count: new Intl.NumberFormat(locale).format(count),
                  })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            {usage.isError && (
              <InlineMessage tone="danger">
                {errorText(usage.error, t)}
              </InlineMessage>
            )}
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            disabled={count === undefined}
            loading={remove.isPending}
            onClick={() => {
              setError(null);
              remove
                .mutateAsync(tag)
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("tags.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
