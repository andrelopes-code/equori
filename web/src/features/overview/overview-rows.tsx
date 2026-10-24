import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import type { ReactNode } from "react";

export interface OverviewRow {
  key: string;
  title: ReactNode;
  line?: ReactNode;
  end?: ReactNode;
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
      {rows.map((row) => (
        <ListItem key={row.key}>
          <ListItemContent>
            <ListItemBody>
              <ListItemLabel>{row.title}</ListItemLabel>
              {row.line !== undefined && (
                <ListItemDescription>{row.line}</ListItemDescription>
              )}
            </ListItemBody>
            {row.end !== undefined && <ListItemEnd>{row.end}</ListItemEnd>}
          </ListItemContent>
        </ListItem>
      ))}
    </List>
  );
}
