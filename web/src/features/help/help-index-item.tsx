import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";

import { splitHelpPage } from "@/features/help/help-pages";
import { useHelpPage } from "@/features/help/use-help-page";
import { routeTo } from "@/ui/route-to";

interface HelpIndexItemProps {
  id: string;
}

// The title and the lead come from the page itself, so the index never repeats its words.
export function HelpIndexItem({ id }: HelpIndexItemProps) {
  const query = useHelpPage(id);

  if (query.data === null) return null;

  const text = query.data === undefined ? null : splitHelpPage(query.data);

  return (
    <ListItem>
      <ListItemLink
        render={routeTo({ to: "/help/$page", params: { page: id } })}
      >
        <ListItemBody>
          <ListItemLabel>
            {text?.title ?? <Skeleton shape="text" />}
          </ListItemLabel>
          <ListItemDescription>{text?.lead}</ListItemDescription>
        </ListItemBody>
      </ListItemLink>
    </ListItem>
  );
}
