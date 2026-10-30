import type { MediaViewerItem } from "@slotted/react/media-viewer";

import type { components } from "@/api/schema.gen";
import { numberFormatter } from "@/i18n/format";

type Attachment = components["schemas"]["Attachment"];

export function contentURL(id: string): string {
  return `/api/v1/attachments/${id}/content`;
}

// A PDF is framed from the inline disposition, the one response that admits a frame (ADR 007,
// C9a); the download keeps the attachment disposition.
export function mediaItem(file: Attachment): MediaViewerItem {
  const content = contentURL(file.id);
  const pdf = file.media_type === "application/pdf";

  return {
    id: file.id,
    src: pdf ? `${content}?disposition=inline` : content,
    name: file.file_name,
    type: file.media_type,
    downloadHref: content,
  };
}

const units = [
  { unit: "byte", limit: 1024 },
  { unit: "kilobyte", limit: 1024 ** 2 },
  { unit: "megabyte", limit: 1024 ** 3 },
  { unit: "gigabyte", limit: Infinity },
] as const;

// A file size in the largest binary-based unit under 1024, written by Intl in the tag.
export function formatFileSize(bytes: number, tag: string): string {
  const index = units.findIndex(({ limit }) => bytes < limit);
  const value = bytes / 1024 ** index;
  return numberFormatter(tag, {
    style: "unit",
    unit: units[index]?.unit ?? "byte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatUploaded(iso: string, tag: string): string {
  return new Intl.DateTimeFormat(tag, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
