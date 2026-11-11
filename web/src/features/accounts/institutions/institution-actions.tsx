import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { toast } from "@slotted/react/toast";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useSetInstitutionIdentifier } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";

type Institution = components["schemas"]["Institution"];

export function InstitutionActions({
  institution,
  onSetLogo,
  onEditIdentifier,
  onDelete,
}: {
  institution: Institution;
  onSetLogo: () => void;
  onEditIdentifier: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const setIdentifier = useSetInstitutionIdentifier();
  return (
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
        <MenuItem onSelect={onSetLogo}>{t("institutions.setLogo")}</MenuItem>
        <MenuItem onSelect={onEditIdentifier}>
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
        <MenuItem onSelect={onDelete}>{t("institutions.delete")}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
