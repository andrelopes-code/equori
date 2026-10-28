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
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import type { LinkOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { routeTo } from "@/ui/route-to";

export interface PhoneRow {
  key: string;
  title: ReactNode;
  // A row with a link opens its record; a row without one only shows it.
  link?: LinkOptions;
  // One line each under the title; a tag or a status stands on a line of its own.
  lines?: ReactNode[];
  end?: ReactNode;
  actions?: ReactNode;
}

// Below 600 px a table of records is one surface of rows (mobile.md M1, record work): the title,
// its lines, a figure at the end and the row's actions beside it.
export function PhoneList({
  label,
  rows,
  loading,
  empty,
}: {
  label: string;
  rows: PhoneRow[];
  loading: boolean;
  empty: string;
}) {
  if (loading)
    return (
      <Stack gap={2} aria-busy="true">
        <Skeleton shape="block" blockSize="4rem" />
        <Skeleton shape="block" blockSize="4rem" />
        <Skeleton shape="block" blockSize="4rem" />
      </Stack>
    );
  if (rows.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{empty}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  return (
    <List aria-label={label} variant="framed">
      {rows.map((row) => {
        const body = (
          <>
            <ListItemBody>
              <ListItemLabel>{row.title}</ListItemLabel>
              {(row.lines ?? []).map((line, index) => (
                <ListItemDescription key={index}>{line}</ListItemDescription>
              ))}
            </ListItemBody>
            {row.end !== undefined && <ListItemEnd>{row.end}</ListItemEnd>}
          </>
        );
        return (
          <ListItem key={row.key}>
            {row.link === undefined ? (
              <ListItemContent>{body}</ListItemContent>
            ) : (
              <ListItemLink render={routeTo(row.link)}>{body}</ListItemLink>
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
