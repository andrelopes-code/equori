import {
  SideNavigationItem,
  SideNavigationLabel,
  SideNavigationLink,
} from "@slotted/react/side-navigation";
import { Skeleton } from "@slotted/react/skeleton";

import { splitHelpPage } from "@/features/help/help-pages";
import { useHelpPage } from "@/features/help/use-help-page";
import { routeTo } from "@/ui/route-to";

interface HelpNavigationItemProps {
  id: string;
}

// The page's own title names its row.
export function HelpNavigationItem({ id }: HelpNavigationItemProps) {
  const query = useHelpPage(id);

  if (query.data === null) return null;

  const title =
    query.data === undefined ? null : splitHelpPage(query.data).title;

  return (
    <SideNavigationItem value={id}>
      <SideNavigationLink
        render={routeTo({ to: "/help/$page", params: { page: id } })}
      >
        <SideNavigationLabel>
          {title ?? <Skeleton shape="text" />}
        </SideNavigationLabel>
      </SideNavigationLink>
    </SideNavigationItem>
  );
}
