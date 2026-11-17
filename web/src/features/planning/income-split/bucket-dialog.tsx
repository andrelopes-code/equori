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
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { BucketEndConfirm } from "@/features/planning/income-split/bucket-end-confirm";
import { BucketPots } from "@/features/planning/income-split/dialog/bucket-pots";
import { BucketPresets } from "@/features/planning/income-split/dialog/bucket-presets";
import { CategoryMatrix } from "@/features/planning/income-split/dialog/category-matrix";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { BucketValidFrom } from "@/features/planning/income-split/versions/bucket-valid-from";
import { useBucketDraft } from "@/features/planning/income-split/use-bucket-draft";
import { useValidFrom } from "@/features/planning/income-split/versions/use-valid-from";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Bucket = components["schemas"]["BudgetBucket"];

interface BucketDialogProps {
  // The stored method; undefined while the book has none.
  stored: readonly Bucket[] | undefined;
  entries: readonly CategoryEntry[];
  // The month on screen: the default start of the version.
  month: string;
  // A preselected start of the version.
  from?: string;
  onClose: () => void;
}

// The income split in one dialog (dialog spec A249 to A253): the buckets with their shares,
// the bucket of each expense category, and the month the version starts in.
export function BucketDialog({
  stored,
  entries,
  month,
  from,
  onClose,
}: BucketDialogProps) {
  const t = useT();
  const edit = useBucketDraft(stored, entries, onClose);
  const valid = useValidFrom(month, from);
  const [confirming, setConfirming] = useState(false);

  const hasMethod = (stored?.length ?? 0) > 0;
  const empty = edit.draft.buckets.length === 0;
  const first = valid.chosen?.kind === "version" && valid.chosen.first;

  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  return (
    <Dialog
      open
      size="full"
      fullScreen="never"
      initialFocus="container"
      onOpenChange={change}
    >
      <DialogContent className={styles.splitDialog}>
        <DialogHeader>
          <DialogTitle>{t("buckets.title")}</DialogTitle>
          <DialogDescription>{t("buckets.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className={styles.split}>
            {confirming && (
              <BucketEndConfirm
                month={valid.start}
                all={first}
                onEnd={() => {
                  edit.end(valid.start);
                }}
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

            {empty && <BucketPresets onPreset={edit.preset} />}
            {!empty && (
              <BucketPots
                draft={edit.draft}
                entries={entries}
                onChange={edit.setBucket}
                onRemove={edit.removeBucket}
                onAdd={edit.addBucket}
                onPreset={edit.preset}
              />
            )}
            {!empty && (
              <CategoryMatrix
                entries={entries}
                draft={edit.draft}
                onChoices={edit.setChoices}
              />
            )}

            {hasMethod && (
              <div className={styles.endRow}>
                <Button
                  size="sm"
                  variant="ghost"
                  tone="danger"
                  disabled={edit.saving || confirming || valid.pending}
                  onClick={() => {
                    setConfirming(true);
                  }}
                >
                  {t("buckets.end")}
                </Button>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <BucketValidFrom
            pending={valid.pending}
            choices={valid.choices}
            chosen={valid.chosen}
            until={valid.until}
            onChange={valid.choose}
          />
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("buckets.cancel")}
          </Button>
          <Button
            disabled={!edit.savable || edit.saving || valid.pending}
            onClick={() => {
              edit.save(valid.start);
            }}
          >
            {t("buckets.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
