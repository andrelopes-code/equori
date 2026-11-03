import { Button } from "@slotted/react/button";
import { List } from "@slotted/react/list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { passkeysAvailable } from "@/features/session";
import { useRemovePasskey } from "@/features/setup/api";
import type { Passkey } from "@/features/setup/api";
import { PasskeyDialog } from "@/features/setup/passkey-dialog";
import { PasskeyRow } from "@/features/setup/passkey-row";
import { PasswordDialog } from "@/features/setup/password-dialog";
import { SettingsGroup } from "@/features/setup/settings-group";
import { useT } from "@/i18n/i18n-provider";

interface SecurityPasskeysGroupProps {
  passkeys: Passkey[];
  onCodes: (codes: string[]) => void;
}

export function SecurityPasskeysGroup({
  passkeys,
  onCodes,
}: SecurityPasskeysGroupProps) {
  const t = useT();
  const remove = useRemovePasskey();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Passkey | null>(null);

  const available = passkeysAvailable();

  const handleOpenAdd = () => {
    setAdding(true);
  };

  const handleCloseAdd = () => {
    setAdding(false);
  };

  const handleCloseRemove = () => {
    setRemoving(null);
  };

  return (
    <SettingsGroup
      title={t("security.passkeys.title")}
      description={t("security.passkeys.description")}
      actions={
        available && (
          <Button variant="outline" size="sm" onClick={handleOpenAdd}>
            {t("security.passkeys.add")}
          </Button>
        )
      }
    >
      <Stack gap={4}>
        {passkeys.length === 0 ? (
          <Text size="sm" tone="muted">
            {t("security.passkeys.empty")}
          </Text>
        ) : (
          <List variant="ruled" inset aria-label={t("security.passkeys.title")}>
            {passkeys.map((passkey) => (
              <PasskeyRow
                key={passkey.id}
                passkey={passkey}
                onRemove={() => {
                  setRemoving(passkey);
                }}
              />
            ))}
          </List>
        )}
        {!available && (
          <Text size="sm" tone="muted">
            {t("security.passkeys.unavailable")}
          </Text>
        )}
      </Stack>
      {adding && <PasskeyDialog onClose={handleCloseAdd} onCodes={onCodes} />}
      {removing !== null && (
        <PasswordDialog
          title={t("security.passkeys.removeTitle", { name: removing.name })}
          hint={t("security.passkeys.removeHint")}
          action={t("security.passkeys.remove")}
          onConfirm={(password) =>
            remove.mutateAsync({ id: removing.id, password })
          }
          onClose={handleCloseRemove}
        />
      )}
    </SettingsGroup>
  );
}
