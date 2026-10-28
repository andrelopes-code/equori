import {
  type Alert,
  AlertActions as SlottedAlertActions,
} from "@slotted/react/alert";
import { ButtonDefaultsProvider } from "@slotted/react/button";
import type { ComponentProps, ReactNode } from "react";

// The actions of an Alert: the primary action is a solid Button, every other one `variant="ghost"`.
// Workaround for Slotted issue #15: AlertActions leaves its buttons at accent and md, so this passes the alert's tone and sm.
export function AlertActions({
  tone,
  children,
}: {
  tone: NonNullable<ComponentProps<typeof Alert>["tone"]>;
  children: ReactNode;
}) {
  return (
    <SlottedAlertActions>
      <ButtonDefaultsProvider tone={tone} size="sm">
        {children}
      </ButtonDefaultsProvider>
    </SlottedAlertActions>
  );
}
