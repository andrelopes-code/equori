import { PageHeaderBack, PageHeaderNav } from "@slotted/react/page-header";
import type { ComponentProps } from "react";

import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

// The way back of a page below a destination. Below 1024 px the shell's top app bar carries it,
// so a page draws none there and no screen shows two.
export function PageBack(props: ComponentProps<typeof PageHeaderBack>) {
  const wide = useMediaQuery(wideQuery);
  return wide ? (
    <PageHeaderNav>
      <PageHeaderBack {...props} />
    </PageHeaderNav>
  ) : null;
}
