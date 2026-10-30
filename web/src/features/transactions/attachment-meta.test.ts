import { describe, expect, it } from "vitest";

import { mediaItem } from "@/features/transactions/attachment-meta";

describe("mediaItem", () => {
  const file = (mediaType: string) => ({
    id: "d0000000-0000-4000-8000-000000000001",
    transaction_id: "a0000000-0000-4000-8000-000000000001",
    file_name: "file",
    media_type: mediaType,
    size: 1,
    sha256: "0".repeat(64),
    created_at: "2026-10-12T12:00:00Z",
  });
  const content =
    "/api/v1/attachments/d0000000-0000-4000-8000-000000000001/content";

  it.each([
    { mediaType: "image/png", src: content },
    { mediaType: "application/pdf", src: `${content}?disposition=inline` },
  ])(
    "shows a $mediaType from $src and downloads the content",
    ({ mediaType, src }) => {
      expect(mediaItem(file(mediaType))).toEqual({
        id: "d0000000-0000-4000-8000-000000000001",
        src,
        name: "file",
        type: mediaType,
        downloadHref: content,
      });
    },
  );
});
