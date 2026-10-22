import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { criteria } from "@/features/accounts/candidate-score";
import { useT } from "@/i18n/i18n-provider";

type ScoredCandidate = components["schemas"]["ScoredCandidate"];

// WS-02: the score taken apart, each criterion with the points it earned of its maximum, summed
// back to the score in the summary row.
export function CandidateScoreTable({
  candidate,
  name,
}: {
  candidate: ScoredCandidate;
  name: string;
}) {
  const t = useT();
  return (
    <Table columns={3} variant="plain">
      <TableContent>
        <TableCaption>{t("batch.scoreOf", { name })}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("batch.criterion")}</TableColumnHeader>
            <TableColumnHeader>{t("batch.found")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("batch.points")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {criteria(candidate).map((row) => (
            <TableRow key={row.label}>
              <TableRowHeader>{t(row.label)}</TableRowHeader>
              <TableCell>{t(row.level)}</TableCell>
              <TableCell numeric>
                {t("batch.pointsOf", { points: row.points, max: row.max })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableSummary>
          <TableRow>
            <TableRowHeader colSpan={2}>{t("batch.score")}</TableRowHeader>
            <TableCell numeric>{String(candidate.score)}</TableCell>
          </TableRow>
        </TableSummary>
      </TableContent>
    </Table>
  );
}
