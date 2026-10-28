import { DashboardWidget } from "@slotted/react/dashboard-grid";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import { OverviewLink } from "@/features/overview/overview-link";
import { useT } from "@/i18n/i18n-provider";

// The page sets these on each block element, and the block hands them to its widget: the grid
// reads a direct child's props before the first paint, and places a widget declared inside a
// component only after it.
export interface Placement {
  value: string;
  title: string;
  defaultColumns: number;
  defaultRows: number;
  removable: boolean;
}

// Columns are of the twelve at the desk; rows are the grid's, 4.5rem each. A block that holds
// exceptions stays on the page (analytics design 5.2).
export function placement(
  value: string,
  title: string,
  columns: number,
  rows: number,
  removable = true,
): Placement {
  return {
    value,
    title,
    defaultColumns: columns,
    defaultRows: rows,
    removable,
  };
}

// One question of the overview, one widget of its grid. It loads, fails and stays empty on its
// own, so a failed operation never takes another block with it. The widget is the block's only
// frame: what it holds is drawn plain (OV-05).
export function OverviewBlock({
  placement,
  link,
  loading,
  error,
  onRetry,
  empty,
  footer,
  children,
}: {
  placement: Placement;
  link?: { label: string; options: NavigateOptions } | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  // The sentence of an empty block; undefined when the block holds something.
  empty?: string | undefined;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const t = useT();
  let status: "ready" | "empty" | "error" = "ready";
  if (error !== null) status = "error";
  else if (!loading && empty !== undefined) status = "empty";
  return (
    <DashboardWidget
      {...placement}
      loading={loading && error === null}
      status={status}
      emptyTitle={empty}
      errorTitle={t("common.error.title")}
      errorDescription={
        error instanceof ProblemError
          ? problemMessage(error.problem, t)
          : undefined
      }
      onRetry={onRetry}
      footer={footer}
      actions={
        link !== undefined && (
          // The visible word stays short so a narrow widget keeps its title on one line.
          <OverviewLink options={link.options} label={link.label}>
            {t("overview.open")}
          </OverviewLink>
        )
      }
    >
      {children}
    </DashboardWidget>
  );
}
