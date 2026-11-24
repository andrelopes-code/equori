import type { CellAnswer } from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";
import { limitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { figureText } from "@/features/portfolio/contribution-plan/criteria/model/figure-text";
import { reasonText } from "@/features/instruments";
import { formatDate } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

interface CellContext {
  t: TFunction;
  locale: string;
  asset: string;
  criterion: string;
  fact: string;
}

// The second line of a cell: the figure equori read, or that it has none or that the criterion does
// not apply, so the answer is the investor's; "" for an own criterion and a signal.
export function cellNote(cell: CellAnswer, context: CellContext): string {
  const { t, locale, fact } = context;

  if (cell.kind === "pending") return "";
  if (cell.kind === "own") {
    if (cell.reason === undefined) return "";

    return cell.reason === "chart"
      ? t("contributionPlan.criteria.noteOutside")
      : t("contributionPlan.criteria.noteOwn");
  }

  return cell.detail.value === undefined
    ? ""
    : figureText(
        locale,
        limitCriterion(fact)?.unit ?? "times",
        cell.detail.value,
      );
}

// The accessible name of a cell, which is also its title: the asset, the criterion, the answer and
// where it comes from.
export function cellLabel(cell: CellAnswer, context: CellContext): string {
  const { t, locale, asset, criterion } = context;

  if (cell.kind === "pending") {
    return t("contributionPlan.criteria.cellWaiting", { asset, criterion });
  }

  const answer = t(
    cell.yes ? "contributionPlan.criteria.yes" : "contributionPlan.criteria.no",
  );

  if (cell.kind === "own") {
    return cell.reason === undefined
      ? t("contributionPlan.criteria.cellOwn", { asset, criterion, answer })
      : t("contributionPlan.criteria.cellOwnReason", {
          asset,
          criterion,
          answer,
          reason: reasonText(t, cell.reason),
        });
  }

  const { value, reason, date } = cell.detail;

  if (value !== undefined && date !== undefined) {
    return t("contributionPlan.criteria.cellAutomatic", {
      asset,
      criterion,
      answer,
      figure: cellNote(cell, context),
      date: formatDate(date, locale),
    });
  }

  return reason === undefined
    ? t("contributionPlan.criteria.cellSignal", { asset, criterion, answer })
    : t("contributionPlan.criteria.cellReason", {
        asset,
        criterion,
        answer,
        reason: reasonText(t, reason),
      });
}
