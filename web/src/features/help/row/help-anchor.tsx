import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface HelpAnchorProps {
  className: string | undefined;
  page: string;
  // The id of a section or of a term of the page.
  hash?: string | undefined;
  active?: boolean;
  children: ReactNode;
}

// The link of an own element of the help (a row, a stop of the path, the first result): the
// element's class sets its colour, its size and its focus ring, so no family draws it.
export function HelpAnchor({
  className,
  page,
  hash,
  active = false,
  children,
}: HelpAnchorProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- O13 guards a link without size or colour; the class of the own element sets both.
    <Link
      className={className}
      data-active={active ? "" : undefined}
      to="/help/$page"
      params={{ page }}
      hash={hash ?? ""}
    >
      {children}
    </Link>
  );
}
