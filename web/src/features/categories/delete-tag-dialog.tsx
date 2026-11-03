import { InlineMessage } from "@slotted/react/inline-message";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { tagUsageQuery, useDeleteTag } from "@/features/categories/api";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

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

  const count = usage.data?.transactions;
  const description =
    count === undefined
      ? t("tags.deleteCounting", { name: tag })
      : count === 1
        ? t("tags.deleteOne", { name: tag })
        : t("tags.deleteMany", {
            name: tag,
            count: numberFormatter(locale).format(count),
          });

  function handleConfirm() {
    setError(null);
    remove
      .mutateAsync(tag)
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("tags.deleteTitle", { name: tag })}
      description={description}
      confirmLabel={t("tags.delete")}
      confirmDisabled={count === undefined}
      pending={remove.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      {usage.isError && (
        <InlineMessage tone="danger">{errorText(usage.error, t)}</InlineMessage>
      )}
    </ConfirmDialog>
  );
}
