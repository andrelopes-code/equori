import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { Upload } from "@slotted/react/upload";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { InvestmentFileCash } from "@/features/accounts/investment-file/investment-file-cash";
import { useInvestmentFile } from "@/features/accounts/investment-file/use-investment-file";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Account = components["schemas"]["Account"];

interface InvestmentFileDialogProps {
  brokerage: Account;
  scale: (code: string) => number;
  onClose: () => void;
}

// The size ceiling of the price import: 10,000 lines of about 50 bytes.
const maxBytes = 2 * 1024 * 1024;

const header =
  "kind,date,instrument,quantity,unit_price,fees,taxes,gross,withheld,income_type,exchange_rate";

// IF1: checks a CSV file of openings, trades and incomes, then records it all or nothing.
export function InvestmentFileDialog({
  brokerage,
  scale,
  onClose,
}: InvestmentFileDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const state = useInvestmentFile(brokerage.id, t);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("investmentFile.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Text size="sm">
              {t("investmentFile.header")} <code>{header}</code>
            </Text>

            <Field required invalid={state.problems.length > 0}>
              <FieldLabel>{t("investmentFile.file")}</FieldLabel>
              <Upload
                accept=".csv,text/csv"
                maxSize={maxBytes}
                preview="none"
                view="none"
                files={state.files}
                onFilesChange={state.changeFiles}
              />
              {state.problems.map((line) => (
                <FieldError key={line}>{line}</FieldError>
              ))}
            </Field>

            <Field>
              <FieldLabel>{t("investmentFile.category")}</FieldLabel>
              <CategoryPicker
                placeholder={t("entry.categoryPlaceholder")}
                value={state.categoryId}
                amount={1}
                onChange={state.changeCategory}
              />
            </Field>

            <InvestmentFileCash
              brokerage={brokerage}
              value={state.cashAccountId}
              scale={scale}
              onChange={state.changeCash}
            />

            {state.checked !== null && (
              <FormNotice tone="success">
                {t("investmentFile.counts", {
                  lines: state.checked.lines,
                  created: state.checked.created,
                  skipped: state.checked.skipped,
                })}
              </FormNotice>
            )}

            {state.done !== null && (
              <FormNotice tone="success">
                {t("investmentFile.done", {
                  created: state.done.created,
                  skipped: state.done.skipped,
                })}
              </FormNotice>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          {state.done === null && (
            <Button
              variant="outline"
              tone="secondary"
              disabled={state.file === undefined}
              loading={state.pending}
              onClick={state.check}
            >
              {t("investmentFile.check")}
            </Button>
          )}
          {state.done === null && (
            <Button
              disabled={state.file === undefined}
              loading={state.pending}
              onClick={state.submit}
            >
              {t("investmentFile.import")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
