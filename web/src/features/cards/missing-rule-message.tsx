import { InlineMessage } from "@slotted/react/inline-message";
import { Link } from "@slotted/react/link";

import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";

export function MissingRuleMessage({ accountId }: { accountId: string }) {
  const t = useT();
  const spaLink = useSpaLink();
  return (
    <InlineMessage tone="warning" size="md">
      {t("cards.rule.missing")}{" "}
      <Link {...spaLink(`/cards/${accountId}/settings`)}>
        {t("cards.rule.link")}
      </Link>
    </InlineMessage>
  );
}
