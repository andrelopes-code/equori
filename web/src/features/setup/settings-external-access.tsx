import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { AccessTokenDeleteDialog } from "@/features/setup/access-token-delete-dialog";
import { AccessTokenDialog } from "@/features/setup/access-token-dialog";
import { accessTokensQuery } from "@/features/setup/api";
import type { AccessToken } from "@/features/setup/api";
import { isPrivateOrigin } from "@/features/setup/is-private-origin";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Open = { kind: "create" } | { kind: "delete"; token: AccessToken };

// The personal access tokens that open /mcp (design 2026-10-26 3.6). A token's text is never read
// back; a row says its access, when it was created and used, and when it expires.
export function SettingsExternalAccess() {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const tokens = useQuery(accessTokensQuery(api));
  const [open, setOpen] = useState<Open | null>(null);
  const date = (iso: string) => formatDate(iso.slice(0, 10), locale);
  const close = () => {
    setOpen(null);
  };

  return (
    <SettingsSection
      topic="external_access"
      title={t("settings.external_access.title")}
      description={t("settings.external_access.description")}
    >
      <SettingsGroup>
        <Stack gap={5}>
          <Stack gap={2}>
            <Text size="sm" tone="muted">
              {t("settings.external_access.privacy")}
            </Text>
            <Text size="sm" tone="muted">
              {t("settings.external_access.write_warning")}
            </Text>
          </Stack>
          {isPrivateOrigin(window.location.origin) && (
            <InlineMessage tone="info">
              {t("settings.external_access.reachability")}
            </InlineMessage>
          )}
          {tokens.error !== null && (
            <InlineMessage tone="danger">
              {errorText(tokens.error, t)}
            </InlineMessage>
          )}
          {tokens.isPending ? (
            <SkeletonText lines={2} />
          ) : (
            <List
              variant="ruled"
              aria-label={t("settings.external_access.title")}
            >
              {(tokens.data ?? []).length === 0 && (
                <ListEmpty>{t("settings.external_access.empty")}</ListEmpty>
              )}
              {(tokens.data ?? []).map((token) => (
                <ListItem key={token.id}>
                  <ListItemContent>
                    <ListItemBody>
                      <ListItemLabel>{token.name}</ListItemLabel>
                      <ListItemDescription>
                        {[
                          t(
                            token.scope === "write"
                              ? "settings.external_access.scope.write"
                              : "settings.external_access.scope.read",
                          ),
                          t("settings.external_access.created", {
                            date: date(token.created_at),
                          }),
                          token.last_used_at === undefined
                            ? t("settings.external_access.unused")
                            : t("settings.external_access.used", {
                                date: date(token.last_used_at),
                              }),
                          t("settings.external_access.expires", {
                            date: date(token.expires_at),
                          }),
                        ].join(" · ")}
                      </ListItemDescription>
                    </ListItemBody>
                  </ListItemContent>
                  <ListItemActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="danger"
                      onClick={() => {
                        setOpen({ kind: "delete", token });
                      }}
                    >
                      {t("settings.external_access.delete")}
                    </Button>
                  </ListItemActions>
                </ListItem>
              ))}
            </List>
          )}
          <div>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={() => {
                setOpen({ kind: "create" });
              }}
            >
              {t("settings.external_access.create")}
            </Button>
          </div>
        </Stack>
      </SettingsGroup>
      {open?.kind === "create" && <AccessTokenDialog onClose={close} />}
      {open?.kind === "delete" && (
        <AccessTokenDeleteDialog token={open.token} onClose={close} />
      )}
    </SettingsSection>
  );
}
