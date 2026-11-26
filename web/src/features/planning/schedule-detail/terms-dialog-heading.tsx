import { DialogDescription, DialogTitle } from "@slotted/react/dialog";

import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TermsDialogHeadingProps {
  revised: string | undefined;
  first: boolean;
  after: string | undefined;
}

// The title and the hint of the terms dialog: a new version, the latest one revised, or the
// first one revised, whose amount alone changes.
export function TermsDialogHeading({
  revised,
  first,
  after,
}: TermsDialogHeadingProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (revised === undefined)
    return (
      <>
        <DialogTitle>{t("schedule.changeTerms")}</DialogTitle>
        <DialogDescription>
          {t("schedule.changeTermsHint", {
            date: after === undefined ? "" : formatDate(after, locale),
          })}
        </DialogDescription>
      </>
    );

  return (
    <>
      <DialogTitle>
        {t("schedule.terms.reviseTitle", { date: formatDate(revised, locale) })}
      </DialogTitle>
      <DialogDescription>
        {first
          ? t("schedule.terms.reviseFirstHint")
          : t("schedule.terms.reviseHint")}
      </DialogDescription>
    </>
  );
}
