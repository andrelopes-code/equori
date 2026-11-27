import { Button } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
  DrawerResizer,
  DrawerTitle,
  DrawerTrigger,
} from "@slotted/react/drawer";
import { Field, FieldLabel } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { Stack } from "@slotted/react/stack";
import type { ReactNode } from "react";

import { BasisControl } from "@/features/accounts/sheet-bar/basis-control";
import { GroupControl } from "@/features/accounts/sheet-bar/group-control";
import { OrderControl } from "@/features/accounts/sheet-bar/order-control";
import styles from "@/features/accounts/sheet-bar/sheet-bar.module.css";
import type { SheetBarProps } from "@/features/accounts/sheet-bar/sheet-bar-props";
import { useT } from "@/i18n/i18n-provider";

interface SheetBarPhoneProps extends Omit<SheetBarProps, "date" | "closed"> {
  date: ReactNode;
  closed: ReactNode;
  // Whether the closed accounts are shown, for the count on the button.
  showsClosed: boolean;
}

// One row above the list: the date the sheet is read at, and the button that opens the rest of
// the view as a bottom sheet (mobile.md M2, M5). The button counts the choices that change
// which balances the sheet shows.
export function SheetBarPhone({
  date,
  closed,
  showsClosed,
  basis,
  group,
  order,
  onBasisChange,
  onGroupChange,
  onOrderChange,
}: SheetBarPhoneProps) {
  const t = useT();

  const count = Number(basis === "settled") + Number(showsClosed);
  const label =
    count === 0
      ? t("balanceSheet.view")
      : t("balanceSheet.viewCount", { count: String(count) });

  return (
    <div className={styles.phone}>
      <div className={styles.phoneDate}>{date}</div>

      <Drawer side="bottom">
        <DrawerTrigger
          render={(props) => (
            <Button
              {...props}
              variant="outline"
              tone="secondary"
              start={
                <Icon size="sm">
                  <Glyph name="funnel" />
                </Icon>
              }
            >
              {label}
            </Button>
          )}
        />

        <DrawerPanel>
          <DrawerResizer />

          <DrawerHeader>
            <DrawerTitle>{t("balanceSheet.view")}</DrawerTitle>
          </DrawerHeader>

          <DrawerBody>
            <Stack gap={7}>
              <Field necessity="none">
                <FieldLabel>{t("balanceSheet.groupBy")}</FieldLabel>
                <GroupControl value={group} compact onChange={onGroupChange} />
              </Field>

              <Field necessity="none">
                <FieldLabel>{t("balanceSheet.order")}</FieldLabel>
                <OrderControl value={order} compact onChange={onOrderChange} />
              </Field>

              <Field necessity="none">
                <FieldLabel>{t("balanceSheet.basis")}</FieldLabel>
                <BasisControl value={basis} compact onChange={onBasisChange} />
              </Field>

              {closed}
            </Stack>
          </DrawerBody>
        </DrawerPanel>
      </Drawer>
    </div>
  );
}
