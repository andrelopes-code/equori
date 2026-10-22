import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Drawer,
  DrawerBody,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerResizer,
  DrawerTitle,
  DrawerTrigger,
} from "@slotted/react/drawer";
import type { DrawerTriggerRootProps } from "@slotted/react/drawer";
import { Field, FieldLabel } from "@slotted/react/field";
import { Icon } from "@slotted/react/icon";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemButton,
  ListItemLabel,
  ListItemLink,
  ListItemStart,
} from "@slotted/react/list-item";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useState } from "react";
import type { ReactNode } from "react";

import { useApi } from "@/api/api-context";
import { destinations } from "@/app/shell/destinations";
import styles from "@/app/shell/more-sheet.module.css";
import { ShellIcon } from "@/app/shell/shell-icon";
import type { ShellIconName } from "@/app/shell/shell-icon";
import { meQuery, useChooseLanguage, useLogout } from "@/features/session";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { isLanguage, languages } from "@/i18n/languages";
import { densities, useDensity } from "@/theme/density";
import type { Density } from "@/theme/density";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const listed = destinations.filter((d) => d.phone === "more");

function isScheme(value: string): value is Scheme {
  return (schemes as readonly string[]).includes(value);
}

function isDensity(value: string): value is Density {
  return (densities as readonly string[]).includes(value);
}

function mark(name: ShellIconName) {
  return (
    <ListItemStart>
      <Icon size="lg">
        <ShellIcon name={name} />
      </Icon>
    </ListItemStart>
  );
}

// The phone's More, drawn as Android's modal bottom sheet: a grabber, the destinations the
// navigation bar has no room for, the three display choices set in place, and the way out.
// It moves under a drag and closes on a fling, a press on the scrim or the back gesture.
export function MoreSheet({
  trigger,
  onOpenChange,
}: {
  trigger: (props: DrawerTriggerRootProps) => ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { logout, failed } = useLogout();
  const [scheme, setScheme] = useScheme();
  const [density, setDensity] = useDensity();
  const { language } = useAppLocaleState();
  const chooseLanguage = useChooseLanguage();
  const [open, setOpen] = useState(false);
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });

  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
  };

  return (
    <Drawer side="bottom" open={open} onOpenChange={change}>
      <DrawerTrigger render={trigger} />
      <DrawerPanel className={styles.sheet}>
        <DrawerResizer />
        <DrawerHeader>
          <DrawerTitle>{t("more.title")}</DrawerTitle>
          {me !== undefined && (
            <DrawerDescription>{me.email}</DrawerDescription>
          )}
        </DrawerHeader>
        <DrawerBody>
          <div className={styles.body}>
            <List aria-label={t("more.title")} inset>
              {listed.map((destination) => (
                <ListItem key={destination.key} size="lg">
                  <ListItemLink
                    href={destination.to}
                    onClick={(event) => {
                      event.preventDefault();
                      change(false);
                      void navigate({ to: destination.to });
                    }}
                  >
                    {mark(destination.icon)}
                    <ListItemBody>
                      <ListItemLabel>{t(destination.label)}</ListItemLabel>
                    </ListItemBody>
                  </ListItemLink>
                </ListItem>
              ))}
            </List>
            <div className={styles.choices}>
              <Field>
                <FieldLabel>{t("more.scheme")}</FieldLabel>
                <SegmentedControl
                  fullWidth
                  value={scheme}
                  onValueChange={(next) => {
                    if (isScheme(next)) setScheme(next);
                  }}
                >
                  {schemes.map((s) => (
                    <Segment key={s} value={s}>
                      {t(`scheme.${s}`)}
                    </Segment>
                  ))}
                </SegmentedControl>
              </Field>
              <Field>
                <FieldLabel>{t("more.density")}</FieldLabel>
                <SegmentedControl
                  fullWidth
                  value={density}
                  onValueChange={(next) => {
                    if (isDensity(next)) setDensity(next);
                  }}
                >
                  {densities.map((d) => (
                    <Segment key={d} value={d}>
                      {t(`density.${d}`)}
                    </Segment>
                  ))}
                </SegmentedControl>
              </Field>
              <Field>
                <FieldLabel>{t("more.language")}</FieldLabel>
                <SegmentedControl
                  fullWidth
                  value={language}
                  onValueChange={(next) => {
                    if (isLanguage(next)) chooseLanguage(next);
                  }}
                >
                  {languages.map((l) => (
                    <Segment key={l.language} value={l.language}>
                      {l.nativeName}
                    </Segment>
                  ))}
                </SegmentedControl>
              </Field>
            </div>
            <List aria-label={t("more.logout")} inset>
              <ListItem size="lg" tone="danger">
                <ListItemButton onClick={logout}>
                  {mark("logout")}
                  <ListItemBody>
                    <ListItemLabel>{t("more.logout")}</ListItemLabel>
                  </ListItemBody>
                </ListItemButton>
              </ListItem>
            </List>
            {failed && <p role="alert">{t("more.logoutFailed")}</p>}
          </div>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}
