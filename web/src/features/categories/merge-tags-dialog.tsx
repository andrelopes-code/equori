import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useMergeTags } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// The selected tags become one: the reader chooses which name stays.
export function MergeTagsDialog({
  tags,
  onDone,
  onCancel,
}: {
  tags: readonly string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const merge = useMergeTags();
  const [into, setInto] = useState(tags[0] ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    merge
      .mutateAsync({
        sources: tags.filter((tag) => tag !== into),
        into,
      })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("tags.mergeTitle", { count: tags.length })}
      description={t("tags.mergeDescription")}
      confirmLabel={t("tags.merge")}
      pending={merge.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      <RadioGroup
        aria-label={t("tags.keep")}
        value={into}
        onValueChange={(value) => {
          if (typeof value === "string") setInto(value);
        }}
      >
        {tags.map((tag) => (
          <Radio key={tag} value={tag}>
            {tag}
          </Radio>
        ))}
      </RadioGroup>
    </ConfirmDialog>
  );
}
