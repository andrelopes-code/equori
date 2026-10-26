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
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useMergeTags } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

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
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <AlertDialog open onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("tags.mergeTitle", { count: tags.length })}
          </DialogTitle>
          <DialogDescription>{t("tags.mergeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
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
            loading={merge.isPending}
            onClick={() => {
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
            }}
          >
            {t("tags.merge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
