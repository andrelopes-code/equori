import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@slotted/react/avatar";
import { Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { AccountBooks } from "@/app/shell/account-books";
import { AccountIdentity } from "@/app/shell/account-identity";
import styles from "@/app/shell/account-menu.module.css";
import { ShellIcon } from "@/app/shell/shell-icon";
import { useBooks } from "@/app/shell/use-books";
import { errorText } from "@/api/problem";
import { meQuery, useLogout } from "@/features/session";
import { NewBooksDialog } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

// The column's foot: the signed-in account, and the menu of what belongs to it. In the rail
// only the avatar remains.
export function AccountMenu({ compact }: { compact: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const { logout, failed } = useLogout();
  const books = useBooks();
  const [creating, setCreating] = useState(false);
  // The session guard has loaded /me; the menu reads that answer without asking again.
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  // The part before the @ names the account; the domain adds width and no recognition.
  const name = me?.email.split("@")[0] ?? t("nav.user");
  return (
    <>
      <Menu width={compact ? "content" : "anchor"}>
        <MenuTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              aria-label={t("nav.user")}
              data-own="account-trigger"
              data-compact={compact || undefined}
              className={styles.trigger}
            >
              <Avatar size="sm" name={me?.email ?? name} />
              {!compact && (
                <>
                  <AccountIdentity name={name} />
                  <span className={styles.chevrons}>
                    <ShellIcon name="chevrons" size={16} weight={2} />
                  </span>
                </>
              )}
            </button>
          )}
        />
        <MenuContent>
          <MenuItem
            icon={
              <Icon size="sm">
                <ShellIcon name="settings" />
              </Icon>
            }
            onSelect={() => void navigate({ to: "/settings" })}
          >
            {t("more.settings")}
          </MenuItem>
          <MenuItem
            icon={
              <Icon size="sm">
                <ShellIcon name="help" />
              </Icon>
            }
            onSelect={() => void navigate({ to: "/help" })}
          >
            {t("more.help")}
          </MenuItem>
          <AccountBooks
            books={books}
            onNew={() => {
              setCreating(true);
            }}
          />
          <MenuSeparator />
          <MenuItem
            tone="danger"
            icon={
              <Icon size="sm">
                <ShellIcon name="logout" />
              </Icon>
            }
            onSelect={logout}
          >
            {t("more.logout")}
          </MenuItem>
        </MenuContent>
      </Menu>
      {failed && <p role="alert">{t("more.logoutFailed")}</p>}
      {books.error !== null && <p role="alert">{errorText(books.error, t)}</p>}
      {creating && (
        <NewBooksDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
