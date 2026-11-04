import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import type { ComponentProps, ReactNode } from "react";

interface FormNoticeProps {
  children: ReactNode;
  tone?: ComponentProps<typeof Alert>["tone"];
  className?: string | undefined;
}

// A message about a command, a form or a region: a failure, a warning, an outcome. A message about
// one control is a FieldError or a FieldDescription inside its Field. InlineMessage is never drawn
// on its own (docs/contributing/web.md, O15).
export function FormNotice({
  children,
  tone = "danger",
  className,
}: FormNoticeProps) {
  return (
    <Alert
      tone={tone}
      live={tone === "danger" ? "assertive" : "polite"}
      className={className}
    >
      <AlertContent>
        <AlertDescription>{children}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
