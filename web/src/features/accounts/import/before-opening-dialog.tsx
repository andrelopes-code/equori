import { Text } from "@slotted/react/typography";

import { errorText } from "@/api/problem";
import type { Problem } from "@/api/problem";
import { useUpdateAccount } from "@/features/accounts/api";
import { useOpeningBalanceDate } from "@/features/accounts/import/use-opening-balance-date";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";

interface BeforeOpeningDialogProps {
  accountId: string;
  dates: NonNullable<Problem["before_opening"]>;
  onMoved: () => void;
  onCancel: () => void;
}

// A263: the file holds lines from before the account opens. The opening moves to the first line
// only when the person confirms.
export function BeforeOpeningDialog({
  accountId,
  dates,
  onMoved,
  onCancel,
}: BeforeOpeningDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const update = useUpdateAccount();
  const balance = useOpeningBalanceDate(accountId, dates.first_line_on);

  const first = formatDate(dates.first_line_on, locale);

  function handleConfirm() {
    update.mutate(
      { id: accountId, patch: { opened_on: dates.first_line_on } },
      { onSuccess: onMoved },
    );
  }

  return (
    <ConfirmDialog
      tone="accent"
      title={t("importFile.beforeOpeningTitle", { date: first })}
      description={t("importFile.beforeOpening", {
        first,
        opened: formatDate(dates.opened_on, locale),
      })}
      confirmLabel={t("importFile.moveOpening")}
      pending={update.isPending}
      confirmDisabled={balance.pending}
      error={update.error === null ? null : errorText(update.error, t)}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      {balance.date !== undefined && (
        <Text size="sm">
          {t("importFile.openingBalanceKept", {
            date: formatDate(balance.date, locale),
          })}
        </Text>
      )}
    </ConfirmDialog>
  );
}
