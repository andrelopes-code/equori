import type { CSSProperties } from "react";
import { useRovingGrid } from "@slotted/react/roving-focus";
import { Text } from "@slotted/react/typography";

import { AnswerCell } from "@/features/portfolio/contribution-plan/criteria/board/answer-cell";
import { AssetHead } from "@/features/portfolio/contribution-plan/criteria/board/asset-head";
import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import { CriterionHead } from "@/features/portfolio/contribution-plan/criteria/board/criterion-head";
import type {
  BoardAsset,
  BoardRow,
} from "@/features/portfolio/contribution-plan/criteria/model/board-rows";
import {
  cellLabel,
  cellNote,
} from "@/features/portfolio/contribution-plan/criteria/model/cell-label";
import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface CriteriaBoardProps {
  index: number;
  // The name of the group.
  name: string;
  rows: BoardRow[];
  assets: BoardAsset[];
  editor: PlanEditor;
  // Whether a criterion was added from the board: its field takes the focus.
  fresh: boolean;
  onRemove: (q: number) => void;
  // Opens the data of an asset; undefined when the asset has none.
  openerOf: (asset: BoardAsset) => (() => void) | undefined;
}

// Families read: data-grid, table, toggle-group, matrix of checkbox-group. None draws a grid whose
// cells are the control and whose row heads are fields. Criteria in rows, assets in columns: a text
// fits its row, a code fits its column, and the figures of one criterion stand on one line.
export function CriteriaBoard({
  index,
  name,
  rows,
  assets,
  editor,
  fresh,
  onRemove,
  openerOf,
}: CriteriaBoardProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { cellProps } = useRovingGrid({
    rows: rows.length,
    columns: assets.length,
  });

  const greatest = Math.max(0, ...assets.map((a) => a.ideal ?? 0));

  return (
    <div className={styles.scroll}>
      <div
        role="grid"
        aria-label={t("contributionPlan.criteria.boardLabel", { name })}
        aria-rowcount={rows.length + 1}
        className={styles.board}
        style={{ "--assets": String(assets.length) } as CSSProperties}
      >
        <div role="row" className={cx(styles.row, styles.head)}>
          <div role="columnheader" className={styles.corner}>
            <Text size="xs" tone="muted" weight="medium">
              {t("contributionPlan.criteria.criterionColumn")}
            </Text>
          </div>

          {assets.map((asset) => (
            <AssetHead
              key={asset.name}
              asset={asset}
              count={rows.length}
              greatest={greatest}
              onOpen={openerOf(asset)}
            />
          ))}
        </div>

        {rows.map((row, q) => {
          const text = criterionText(t, row.fact, row.text);

          return (
            // The position is the identity of a criterion: it has no other key.
            <div key={String(q)} role="row" className={styles.row}>
              <CriterionHead
                row={row}
                n={q + 1}
                text={text}
                fresh={fresh && q === rows.length - 1}
                onText={(next) => {
                  editor.setQuestionText(index, q, next);
                }}
                onLimit={(limit) => {
                  editor.setQuestionLimit(index, q, limit);
                }}
                onRemove={() => {
                  onRemove(q);
                }}
              />

              {assets.map((asset, at) => {
                const cell = asset.cells[q] ?? { kind: "pending" };
                const context = {
                  t,
                  locale,
                  asset: asset.name,
                  criterion: text,
                  fact: row.fact,
                };

                return (
                  <AnswerCell
                    key={asset.name}
                    cell={cell}
                    note={cellNote(cell, context)}
                    label={cellLabel(cell, context)}
                    focus={cellProps(q, at)}
                    onAnswer={(yes) => {
                      editor.setAnswer(index, at, q, yes);
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
