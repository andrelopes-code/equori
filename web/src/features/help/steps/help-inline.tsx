import { Link } from "@slotted/react/link";
import type { NavigateOptions } from "@tanstack/react-router";

import { inlineParts } from "@/features/help/model/inline-parts";
import { matchScreen } from "@/navigation/navigation-map";
import { AppLink } from "@/ui/navigation/app-link";

interface HelpInlineProps {
  markdown: string;
  // A step that is itself a button holds no link: its link reads as its words.
  links?: boolean | undefined;
}

// The line of a step: its strong words and its links to screens.
export function HelpInline({ markdown, links = true }: HelpInlineProps) {
  return inlineParts(markdown).map((part, index) => {
    const key = `${String(index)}${part.text}`;

    if (part.type === "strong") return <strong key={key}>{part.text}</strong>;

    if (part.type === "link" && links && matchScreen(part.href) !== undefined) {
      return (
        // matchScreen has checked that the path is a screen of the router.
        <AppLink
          key={key}
          to={{ to: part.href as NonNullable<NavigateOptions["to"]> }}
        >
          {part.text}
        </AppLink>
      );
    }

    if (part.type === "link" && links && part.href.startsWith("https://")) {
      return (
        <Link key={key} href={part.href} external>
          {part.text}
        </Link>
      );
    }

    return part.text;
  });
}
