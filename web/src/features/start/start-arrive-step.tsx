import { ButtonLink } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { Inline } from "@slotted/react/inline";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

interface StartArriveStepProps {
  names: readonly string[];
  // The account an import goes to: the first created account that is not cash.
  importAccountId: string | undefined;
}

// Step 3: the accounts created and the ways their entries arrive.
export function StartArriveStep({
  names,
  importAccountId,
}: StartArriveStepProps) {
  const t = useT();

  return (
    <Stack gap={6}>
      <Text tone="muted">{t("start.arrive.hint")}</Text>

      <List>
        {names.map((name) => (
          <ListItem key={name}>
            <ListItemContent>
              <ListItemBody>
                <ListItemLabel>{name}</ListItemLabel>
              </ListItemBody>
            </ListItemContent>
          </ListItem>
        ))}
      </List>

      <Inline gap={3} wrap="wrap">
        <ButtonLink render={routeTo({ to: "/accounts/links" })}>
          {t("start.arrive.connect")}
        </ButtonLink>
        {importAccountId !== undefined && (
          <ButtonLink
            variant="outline"
            tone="secondary"
            render={routeTo({
              to: "/accounts/$id/import",
              params: { id: importAccountId },
            })}
          >
            {t("start.arrive.import")}
          </ButtonLink>
        )}
        <ButtonLink
          variant="outline"
          tone="secondary"
          render={routeTo({ to: "/transactions/new" })}
        >
          {t("start.arrive.record")}
        </ButtonLink>
      </Inline>

      <Text size="sm">
        <Link
          render={routeTo({
            to: "/help/$page",
            params: { page: "connect-bank" },
          })}
        >
          {t("start.arrive.help")}
        </Link>
      </Text>
    </Stack>
  );
}
