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
} from "@slotted/react/list-item";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { routeTo } from "@/ui/route-to";

export interface OverviewRow {
  key: string;
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
  return (
    <List aria-label={label}>
      {rows.map((row) => {
        const body = (
          <>
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
          <ListItem key={row.key}>
            {row.to === undefined ? (
              <ListItemContent>{body}</ListItemContent>
            ) : (
              <ListItemLink render={routeTo(row.to)}>{body}</ListItemLink>
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
