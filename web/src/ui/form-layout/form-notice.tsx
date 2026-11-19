import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import type { ComponentProps, ReactNode } from "react";

interface FormNoticeProps {
  children: ReactNode;
  // The primary action is the default Button; any other is `variant="ghost"`.
  actions?: ReactNode;
  tone?: ComponentProps<typeof Alert>["tone"];
  // Draws no mark: the warning tone's triangle is forbidden.
  hideIcon?: boolean;
  className?: string | undefined;
}

// A message about a command, a form or a region: a failure, a warning, an outcome. A message about
// one control is a FieldError or a FieldDescription inside its Field. InlineMessage is never drawn
// on its own (docs/contributing/web.md, O15).
export function FormNotice({
  children,
  actions,
  tone = "danger",
  hideIcon,
  className,
}: FormNoticeProps) {
  return (
    <Alert
      tone={tone}
      live={tone === "danger" ? "assertive" : "polite"}
      hideIcon={hideIcon}
      className={className}
    >
      <AlertContent>
        <AlertDescription>{children}</AlertDescription>
      </AlertContent>

      {actions !== undefined && <AlertActions>{actions}</AlertActions>}
    </Alert>
  );
}
