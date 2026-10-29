import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
  ListItemStart,
} from "@slotted/react/list-item";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { routeTo } from "@/ui/route-to";
import { useServed } from "@/ui/use-served";

export interface OverviewRow {
  key: string;
  // A mark before the title; the row then aligns it and the metadata with the title's line.
  start?: ReactNode;
  title: ReactNode;
  line?: ReactNode;
  end?: ReactNode;
  // A row with a destination opens it; a row without one only shows its record.
  to?: NavigateOptions;
  actions?: ReactNode;
}

export function OverviewRows({
  label,
  rows,
}: {
  label: string;
  rows: OverviewRow[];
}) {
  const served = useServed();

  return (
    <List aria-label={label}>
      {rows.map((row) => {
        const body = (
          <>
            {row.start !== undefined && (
              <ListItemStart>{row.start}</ListItemStart>
            )}
            <ListItemBody>
              <ListItemLabel>{row.title}</ListItemLabel>
              {row.line !== undefined && (
                <ListItemDescription>{row.line}</ListItemDescription>
              )}
            </ListItemBody>
            {row.end !== undefined && <ListItemEnd>{row.end}</ListItemEnd>}
          </>
        );
        return (
          <ListItem
            key={row.key}
            {...(row.start === undefined ? {} : { align: "start" as const })}
          >
            {row.to !== undefined && served(row.to) ? (
              <ListItemLink render={routeTo(row.to)}>{body}</ListItemLink>
            ) : (
              <ListItemContent>{body}</ListItemContent>
            )}
            {row.actions !== undefined && (
              <ListItemActions>{row.actions}</ListItemActions>
            )}
          </ListItem>
        );
      })}
    </List>
  );
}
