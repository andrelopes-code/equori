import type { components } from "@/api/schema.gen";
import type { CellAnswer } from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";
import {
  cellAnswer,
  cellPoints,
} from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";
import { criterionStates } from "@/features/portfolio/contribution-plan/criteria/model/criterion-state";
import type { CriterionState } from "@/features/portfolio/contribution-plan/criteria/model/criterion-state";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";

type Group = components["schemas"]["ContributionClass"];

export interface BoardRow {
  text: string;
  fact: string;
  limit: string;
  state: CriterionState;
}

export interface BoardAsset {
  name: string;
  instrument: string | undefined;
  // One cell per row.
  cells: CellAnswer[];
  points: number;
  // The derived ideal inside the group, a fraction; undefined without a yes or before the preview.
  ideal: number | undefined;
}

// The criteria of a class and, per asset, its answers, points and derived ideal. The figures come
// from the last preview of the class.
export function boardOf(
  edit: EditClass,
  answered: Group | undefined,
  memberName: (ref: { account_id?: string; instrument?: string }) => string,
): { rows: BoardRow[]; assets: BoardAsset[] } {
  const states = criterionStates(edit);
  const rows = edit.questions.map((text, q) => ({
    text,
    fact: edit.questionFacts[q] ?? "",
    limit: edit.questionLimits[q] ?? "",
    state: states[q] ?? "ok",
  }));

  const assets = edit.members.map((member) => {
    const stored = rows.map((_, q) => member.answers?.[q] ?? false);
    const cells = rows.map((row, q) =>
      cellAnswer({
        answered,
        member,
        fact: row.fact,
        limit: row.limit,
        stored: stored[q] ?? false,
        complete: row.state === "ok",
      }),
    );
    const bp = answered?.question_ideals
      ? answered.members.find(
          (m) =>
            (m.instrument !== undefined &&
              m.instrument === member.instrument) ||
            (m.account_id !== undefined && m.account_id === member.accountId),
        )?.target_bp
      : undefined;

    return {
      name: memberName({
        ...(member.accountId === undefined
          ? {}
          : { account_id: member.accountId }),
        ...(member.instrument === undefined
          ? {}
          : { instrument: member.instrument }),
      }),
      instrument: member.instrument,
      cells,
      points: cellPoints(cells, stored),
      ideal: bp === undefined ? undefined : bp / 10000,
    };
  });

  return { rows, assets };
}

// The names of the assets no report answers an automatic criterion for.
export function withoutReport(assets: BoardAsset[]): string[] {
  return assets
    .filter((asset) =>
      asset.cells.some(
        (cell) => cell.kind === "own" && cell.reason === "no_report",
      ),
    )
    .map((asset) => asset.name);
}
