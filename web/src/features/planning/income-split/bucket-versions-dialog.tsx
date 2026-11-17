import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { BucketVersionBlock } from "@/features/planning/income-split/bucket-version-block";
import { versionAt } from "@/features/planning/income-split/bucket-versions";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Version = components["schemas"]["BudgetBucketVersion"];

interface BucketVersionsDialogProps {
  versions: readonly Version[];
  // The month on screen: its version carries the in-force mark.
  month: string;
  categories: readonly CategoryEntry[];
  onEdit: (version: Version) => void;
  onClose: () => void;
}

// Every version of the income split, the latest first, with what each one changed.
export function BucketVersionsDialog({
  versions,
  month,
  categories,
  onEdit,
  onClose,
}: BucketVersionsDialogProps) {
  const t = useT();
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  const inForce = versionAt(versions, month)?.from;

  return (
    <Dialog open size="lg" fullScreen="never" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("buckets.history.title")}</DialogTitle>
          <DialogDescription>
            {t("buckets.history.description")}
          </DialogDescription>
          <DialogClose />
        </DialogHeader>

        <DialogBody>
          {versions.length === 0 && (
            <Text size="sm" tone="muted">
              {t("buckets.history.empty")}
            </Text>
          )}
          <Stack gap={6}>
            {versions
              .map((version, i) => ({ version, prev: versions[i - 1] }))
              .reverse()
              .map(({ version, prev }) => (
                <BucketVersionBlock
                  key={version.from}
                  versions={versions}
                  version={version}
                  prev={prev}
                  inForce={version.from === inForce}
                  categories={categories}
                  onEdit={() => {
                    onEdit(version);
                  }}
                />
              ))}
          </Stack>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
