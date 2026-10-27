import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton } from "@slotted/react/skeleton";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { HideBlockMenu } from "@/features/overview/hide-block-menu";
import { OverviewLink } from "@/features/overview/overview-link";
import { QueryError } from "@/ui/query-error";

// One question of the overview. It loads, fails and stays empty on its own, so a failed
// operation never takes another block with it.
export function OverviewBlock({
  title,
  link,
  loading,
  error,
  onRetry,
  empty,
  onHide,
  children,
}: {
  title: string;
  link?: { label: string; options: NavigateOptions } | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  // The sentence of an empty block; undefined when the block holds something.
  empty?: string | undefined;
  // Set for a block the owner may hide (analytics design 5.2).
  onHide?: (() => void) | undefined;
  children?: ReactNode;
}) {
  let body = children;
  if (error !== null) body = <QueryError error={error} onRetry={onRetry} />;
  else if (loading) body = <Skeleton shape="block" blockSize="6rem" />;
  else if (empty !== undefined)
    body = (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{empty}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  return (
    <Section ground="surface" size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
        </SectionTitle>
        {(link !== undefined || onHide !== undefined) && (
          <SectionActions>
            {link !== undefined && (
              <OverviewLink options={link.options}>{link.label}</OverviewLink>
            )}
            {onHide !== undefined && (
              <HideBlockMenu block={title} onHide={onHide} />
            )}
          </SectionActions>
        )}
      </SectionHeader>
      <SectionBody>{body}</SectionBody>
    </Section>
  );
}
