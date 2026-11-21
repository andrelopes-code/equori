import { Link } from "@slotted/react/link";

import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface InBaseLinkProps {
  base: string | undefined;
}

// PC23: the way to the figures in the currency of the cost.
export function InBaseLink({ base }: InBaseLinkProps) {
  const t = useT();

  return (
    <Link
      render={routeTo({
        to: "/portfolio",
        search: (previous) => ({ ...previous, value_in: undefined }),
      })}
    >
      {t("holdings.missing.inBase", { base: base ?? "" })}
    </Link>
  );
}
