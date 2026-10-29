import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { PageBody } from "@slotted/react/page";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { toast } from "@slotted/react/toast";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { AccountMark } from "@/features/accounts/account-mark";
import { HeaderSlot } from "@/features/accounts/header-slot";
import {
  accountsQuery,
  useSetInstitutionIdentifier,
} from "@/features/accounts/api";
import {
  ispbOf,
  logoIndexQuery,
  logoOf,
} from "@/features/accounts/institution-logo";
import { NewInstitutionDialog } from "@/features/accounts/new-institution-dialog";
import { InstitutionIdentifierDialog } from "@/features/accounts/institution-identifier-dialog";
import { SetLogoDialog } from "@/features/accounts/set-logo-dialog";
import { institutionsQuery } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";
import { Presence } from "@/ui/presence";

type Institution = components["schemas"]["Institution"];

export function InstitutionsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const institutions = useQuery(institutionsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const index = useQuery(logoIndexQuery);
  const setIdentifier = useSetInstitutionIdentifier();
  const [creating, setCreating] = useState(false);
  const [logoTarget, setLogoTarget] = useState<Institution | null>(null);
  const [identifierTarget, setIdentifierTarget] = useState<Institution | null>(
    null,
  );

  const actions = (institution: Institution) => (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("institutions.actions", {
              name: institution.name,
            })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem
          onSelect={() => {
            setLogoTarget(institution);
          }}
        >
          {t("institutions.setLogo")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            setIdentifierTarget(institution);
          }}
        >
          {t("institutions.editIdentifier")}
        </MenuItem>
        {institution.identifier !== undefined && (
          <MenuItem
            onSelect={() => {
              setIdentifier
                .mutateAsync({
                  id: institution.id,
                  identifier: null,
                })
                .then(() => {
                  toast.show({
                    tone: "success",
                    title: t("institutions.logoRemoved", {
                      name: institution.name,
                    }),
                  });
                })
                .catch((error: unknown) => {
                  toast.show({
                    tone: "danger",
                    title: errorText(error, t),
                  });
                });
            }}
          >
            {t("institutions.removeLogo")}
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
  const counts = new Map<string, number>();
  for (const account of accounts.data ?? []) {
    if (account.institution_id === undefined) continue;
    counts.set(
      account.institution_id,
      (counts.get(account.institution_id) ?? 0) + 1,
    );
  }
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const rows = [...(institutions.data ?? [])].sort((a, b) =>
    collator.compare(a.name, b.name),
  );

  return (
    <>
      <HeaderSlot slot="subheading">{t("institutions.subtitle")}</HeaderSlot>
      <HeaderSlot slot="actions">
        <HeaderAction
          primary
          label={t("institutions.new")}
          glyph="plus"
          onClick={() => {
            setCreating(true);
          }}
        />
      </HeaderSlot>
      <PageBody>
        {institutions.isError ? (
          <QueryError
            error={institutions.error}
            onRetry={() => void institutions.refetch()}
          />
        ) : (
          <Table columns={5} variant="framed">
            <TableContent>
              <TableCaption>{t("institutions.title")}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("institutions.name")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("institutions.code")}
                  </TableColumnHeader>
                  <TableColumnHeader>
                    {t("institutions.ispb")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("institutions.accounts")}
                  </TableColumnHeader>
                  <TableColumnHeader align="end">
                    <VisuallyHidden>
                      {t("institutions.actionsColumn")}
                    </VisuallyHidden>
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              {institutions.isPending ? (
                <TableLoader skeletonRows={4} />
              ) : (
                <TableBody>
                  {rows.length === 0 && (
                    <TableEmpty>{t("institutions.empty")}</TableEmpty>
                  )}
                  {rows.map((institution) => {
                    const logo = logoOf(institution.identifier, index.data);
                    return (
                      <TableRow key={institution.id} value={institution.id}>
                        <TableRowHeader>
                          <Inline gap={3} wrap="nowrap">
                            <AccountMark
                              shape="square"
                              size="sm"
                              name={institution.name}
                              logo={logo}
                            />
                            <Text size="sm" weight="medium">
                              {institution.name}
                            </Text>
                          </Inline>
                        </TableRowHeader>
                        <TableCell numeric>{institution.code ?? ""}</TableCell>
                        <TableCell>
                          {ispbOf(institution) ?? (
                            <Text size="sm" tone="muted">
                              {t("institutions.noLogo")}
                            </Text>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {String(counts.get(institution.id) ?? 0)}
                        </TableCell>
                        <TableCell align="end">
                          {actions(institution)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </TableContent>
          </Table>
        )}
      </PageBody>
      <Presence value={creating ? creating : undefined}>
        {() => (
          <NewInstitutionDialog
            onCancel={() => {
              setCreating(false);
            }}
            onDone={(name) => {
              setCreating(false);
              toast.show({
                tone: "success",
                title: t("institutions.created", { name }),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={logoTarget ?? undefined}>
        {(institution) => (
          <SetLogoDialog
            institution={institution}
            onCancel={() => {
              setLogoTarget(null);
            }}
            onDone={() => {
              setLogoTarget(null);
              toast.show({
                tone: "success",
                title: t("institutions.logoSet", { name: institution.name }),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={identifierTarget ?? undefined}>
        {(institution) => (
          <InstitutionIdentifierDialog
            institution={institution}
            onCancel={() => {
              setIdentifierTarget(null);
            }}
            onDone={(cleared) => {
              setIdentifierTarget(null);
              toast.show({
                tone: "success",
                title: t(
                  cleared
                    ? "institutions.logoRemoved"
                    : "institutions.identifierSet",
                  { name: institution.name },
                ),
              });
            }}
          />
        )}
      </Presence>
    </>
  );
}
