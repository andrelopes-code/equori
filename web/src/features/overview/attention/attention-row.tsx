import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

export interface AttentionRowProps {
  title: ReactNode;
  line?: ReactNode;
  end?: ReactNode;
  to?: NavigateOptions | undefined;
}

// One row of the attention list: a Slotted list item, a link when it has a served destination.
export function AttentionRow({ title, line, end, to }: AttentionRowProps) {
  const served = useServed();
  const body = (
    <>
      <ListItemBody>
        <ListItemLabel>{title}</ListItemLabel>
        {line !== undefined && (
          <ListItemDescription>{line}</ListItemDescription>
        )}
      </ListItemBody>

      {end !== undefined && <ListItemEnd>{end}</ListItemEnd>}
    </>
  );

  return (
    <ListItem>
      {to !== undefined && served(to) ? (
        <ListItemLink render={routeTo(to)}>{body}</ListItemLink>
      ) : (
        <ListItemContent>{body}</ListItemContent>
      )}
    </ListItem>
  );
}
