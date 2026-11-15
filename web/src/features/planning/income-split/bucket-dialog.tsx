import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { BucketCategories } from "@/features/planning/income-split/bucket-categories";
import { BucketEditList } from "@/features/planning/income-split/bucket-edit-list";
import { BucketRemoveConfirm } from "@/features/planning/income-split/bucket-remove-confirm";
import type { PresetName } from "@/features/planning/income-split/bucket-draft";
import { useBucketDraft } from "@/features/planning/income-split/use-bucket-draft";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Bucket = components["schemas"]["BudgetBucket"];

interface BucketDialogProps {
  // The stored method; undefined while the book has none.
  stored: readonly Bucket[] | undefined;
  entries: readonly CategoryEntry[];
  onClose: () => void;
}

const presetNames: readonly PresetName[] = ["503020", "six", "scratch"];

// The income split in one dialog (income buckets spec 5): a starting point, the buckets with
// their shares, and the bucket of each expense category.
export function BucketDialog({ stored, entries, onClose }: BucketDialogProps) {
  const t = useT();
  const edit = useBucketDraft(stored, entries, onClose);
  const [confirming, setConfirming] = useState(false);
  const hasMethod = (stored?.length ?? 0) > 0;
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  return (
    <Dialog open size="lg" fullScreen="never" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("buckets.title")}</DialogTitle>
          <DialogDescription>{t("buckets.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            {confirming && (
              <BucketRemoveConfirm
                onRemove={edit.remove}
                onKeep={() => {
                  setConfirming(false);
                }}
              />
            )}
            {edit.failure !== null && (
              <Alert tone="danger">
                <AlertContent>
                  <AlertDescription>{edit.failure}</AlertDescription>
                </AlertContent>
              </Alert>
            )}

            <Stack gap={2}>
              <Text size="sm" weight="medium">
                {t("buckets.preset")}
              </Text>
              <ChoiceSelect
                label={t("buckets.preset")}
                placeholder={t("buckets.preset.choose")}
                multiple={false}
                value={null}
                choices={presetNames.map((name) => ({
                  value: name,
                  label: t(`buckets.preset.${name}`),
                }))}
                onChange={(next) => {
                  const name = presetNames.find((p) => p === next);
                  if (name !== undefined) edit.preset(name);
                }}
              />
            </Stack>

            <BucketEditList
              buckets={edit.draft.buckets}
              onChange={edit.setBucket}
              onRemove={edit.removeBucket}
              onAdd={edit.addBucket}
            />

            <BucketCategories
              entries={entries}
              draft={edit.draft}
              onChoices={edit.setChoices}
            />
          </Stack>
        </DialogBody>

        <DialogFooter>
          {hasMethod && (
            <Button
              variant="ghost"
              tone="danger"
              disabled={edit.saving || confirming}
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t("buckets.removeAll")}
            </Button>
          )}
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("buckets.cancel")}
          </Button>
          <Button disabled={!edit.savable || edit.saving} onClick={edit.save}>
            {t("buckets.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
